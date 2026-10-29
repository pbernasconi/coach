// Scale bridge: reads the Renpho Elis 1 over Bluetooth and posts each weigh-in to Coach over Wi-Fi.
//
// Loop: scan for the scale; when it wakes (someone stepped on), connect, answer its handshake (lib/qn), take the
// final reading, disconnect, then post weight_kg and body_fat_pct for that day to POST /api/vitals/sync.
// Readings wait in flash (they survive a restart or an update) and are retried while Coach or Wi-Fi is down.
// Every 15 minutes and after each session the bridge reports its health to Coach (POST /api/vitals/sync/bridge),
// which Settings shows. The last 80 log lines are at http://scale-bridge.local/ (and /status.json).
#include <Arduino.h>
#include <ArduinoOTA.h>
#include <ESPmDNS.h>
#include <HTTPClient.h>
#include <NimBLEDevice.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <esp_system.h>
#include <time.h>

#include "certs.h"
#include "qn.h"

#if __has_include("config.h")
#include "config.h"
#else
#error "Copy include/config.example.h to include/config.h and fill it in (README.md)."
#endif

#ifndef FW_VERSION
#define FW_VERSION "dev"
#endif
#ifndef COACH_HEARTBEAT_URL
#define COACH_HEARTBEAT_URL COACH_URL "/bridge"  // https://…/api/vitals/sync/bridge
#endif

namespace {

constexpr const char* kHostname = "scale-bridge";
constexpr const char* kSource = "Renpho Elis 1 (scale bridge)";
constexpr uint32_t kSessionTimeoutMs = 45000;  // the scale sleeps well before this
constexpr uint32_t kQuietFallbackMs = 3000;    // no frame this long after the unit reply: send "current time"
constexpr uint32_t kCooldownMs = 15000;        // after a reading: ignore the scale's leftover advertising
constexpr uint32_t kRetryCooldownMs = 800;     // after a session with no reading: the scale may still be measuring
constexpr uint32_t kRetryMs = 60000;
constexpr uint32_t kHeartbeatMs = 15 * 60000;
constexpr uint32_t kWifiKickMs = 60000;        // offline this long: reconnect by hand
constexpr uint32_t kWifiRestartMs = 10 * 60000;  // offline this long: restart (readings are kept in flash)
constexpr size_t kMaxPending = 24;

// The QN service layouts (renpho-escs20m const.py). Renpho uses FFF0; some rebrands use FFE0.
const NimBLEUUID kFFF0("fff0"), kFFF1("fff1"), kFFF2("fff2");
const NimBLEUUID kFFE0("ffe0"), kFFE1("ffe1"), kFFE2("ffe2"), kFFE3("ffe3"), kFFE4("ffe4");

// ---- log: Serial plus a ring buffer for the web page --------------------------------------------------------

constexpr size_t kLogLines = 80;
String logRing[kLogLines];
size_t logHead = 0;
uint32_t logSeq = 0;  // lines written since boot: a session's lines are those from its start

void logf(const char* fmt, ...) {
  char msg[220];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(msg, sizeof msg, fmt, ap);
  va_end(ap);
  char stamp[24];
  const time_t now = time(nullptr);
  if (now > 1700000000) {
    struct tm t;
    localtime_r(&now, &t);
    strftime(stamp, sizeof stamp, "%m-%d %H:%M:%S", &t);
  } else {
    snprintf(stamp, sizeof stamp, "+%lus", (unsigned long)(millis() / 1000));
  }
  String line = String(stamp) + "  " + msg;
  Serial.println(line);
  logRing[logHead] = line;
  logHead = (logHead + 1) % kLogLines;
  logSeq++;
}

// The log lines written since `seq` (at most `max`, the newest).
template <typename F>
void linesSince(uint32_t seq, size_t max, F f) {
  uint32_t n = logSeq - seq;
  if (n > kLogLines) n = kLogLines;
  if (n > max) n = max;
  for (uint32_t i = n; i > 0; i--) f(logRing[(logHead + kLogLines - i) % kLogLines]);
}

String jsonString(const String& in) {
  String out = "\"";
  for (size_t i = 0; i < in.length(); i++) {
    const char c = in[i];
    if (c == '"' || c == '\\') {
      out += '\\';
      out += c;
    } else if ((uint8_t)c < 0x20) {
      char u[8];
      snprintf(u, sizeof u, "\\u%04x", (uint8_t)c);
      out += u;
    } else {
      out += c;
    }
  }
  return out + "\"";
}

String hexOf(const uint8_t* b, size_t n) {
  String s;
  char h[3];
  for (size_t i = 0; i < n; i++) {
    snprintf(h, sizeof h, "%02x", b[i]);
    s += h;
  }
  return s;
}

// ---- status light (AtomS3: RGB LED on GPIO 35) --------------------------------------------------------------

void led(uint8_t r, uint8_t g, uint8_t b) {
#ifdef LED_PIN
  neopixelWrite(LED_PIN, r, g, b);
#endif
}

// ---- time ---------------------------------------------------------------------------------------------------

bool timeValid() { return time(nullptr) > 1700000000; }

String localDate(time_t t) {
  struct tm tm;
  localtime_r(&t, &tm);
  char d[11];
  strftime(d, sizeof d, "%Y-%m-%d", &tm);
  return String(d);
}

// Whole years on today's local date, 0 when the clock is not set yet (the scale then skips body fat).
int ageToday() {
  if (!timeValid()) return 0;
  const time_t now = time(nullptr);
  struct tm t;
  localtime_r(&now, &t);
  int age = t.tm_year + 1900 - PROFILE_BIRTH_YEAR;
  if (t.tm_mon + 1 < PROFILE_BIRTH_MONTH || (t.tm_mon + 1 == PROFILE_BIRTH_MONTH && t.tm_mday < PROFILE_BIRTH_DAY)) age--;
  return age;
}

qn::Profile profile() {
  qn::Profile p;
  p.sex = PROFILE_SEX;
  p.age = ageToday();
  p.heightM = PROFILE_HEIGHT_CM / 100.f;
  return p;
}

// ---- readings waiting to be posted --------------------------------------------------------------------------

struct Pending {
  qn::Reading r;
};
Pending pending[kMaxPending];
size_t pendingCount = 0;
qn::Reading lastReading;
Preferences prefs;
uint32_t ledOffAt = 0;
uint32_t lastLiveUnix = 0;  // newest live weigh-in sent: older stored readings must not overwrite its day

// The waiting readings live in flash too, so a restart, an update or a power cut does not lose a weigh-in.
void savePending() {
  if (pendingCount) prefs.putBytes("pending", pending, sizeof(Pending) * pendingCount);
  else prefs.remove("pending");
}

void loadPending() {
  const size_t n = prefs.getBytesLength("pending");
  if (!n || n % sizeof(Pending) || n > sizeof pending) return;
  prefs.getBytes("pending", pending, n);
  pendingCount = n / sizeof(Pending);
  lastReading = pending[pendingCount - 1].r;
}

void enqueue(qn::Reading r) {
  if (r.unixTime == 0 && timeValid()) r.unixTime = (uint32_t)time(nullptr);
  if (r.stored && r.unixTime <= lastLiveUnix) {
    logf("stored %.2f kg skipped: older than the last weigh-in sent", r.weightKg);
    return;
  }
  if (!r.stored && r.unixTime > lastLiveUnix) {
    lastLiveUnix = r.unixTime;
    prefs.putUInt("last_live", lastLiveUnix);
  }
  if (pendingCount == kMaxPending) {
    memmove(pending, pending + 1, sizeof(Pending) * (kMaxPending - 1));
    pendingCount--;
  }
  pending[pendingCount++].r = r;
  lastReading = r;
  savePending();
  logf("%s reading: %.2f kg, body fat %.1f %%, impedance %u", r.stored ? "stored" : "live", r.weightKg,
       r.bodyFatPct, r.impedance);
}

uint32_t lastPostAt = 0;  // unix time of the last weigh-in post, and its HTTP status
int lastPostCode = 0;

// One HTTPS POST to Coach with the bearer token. Returns the HTTP status (negative: no connection).
int postJson(const char* url, const String& body, String* resp) {
  WiFiClientSecure tls;
  tls.setCACert(kRootCAs);
  HTTPClient http;
  http.setTimeout(15000);
  if (!http.begin(tls, url)) return -100;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + COACH_TOKEN);
  const int code = http.POST(body);
  if (resp) *resp = http.getString();
  http.end();
  return code;
}

// Posts every waiting reading in one request, oldest first so the newest of a day wins (the server keeps the last).
bool postPending() {
  if (pendingCount == 0) return true;
  if (WiFi.status() != WL_CONNECTED || !timeValid()) return false;
  for (size_t i = 0; i < pendingCount; i++) {
    if (pending[i].r.unixTime == 0) pending[i].r.unixTime = (uint32_t)time(nullptr);
  }
  // Insertion sort by time: at most kMaxPending entries.
  for (size_t i = 1; i < pendingCount; i++) {
    Pending p = pending[i];
    size_t j = i;
    for (; j > 0 && pending[j - 1].r.unixTime > p.r.unixTime; j--) pending[j] = pending[j - 1];
    pending[j] = p;
  }
  String body = "{\"samples\":[";
  bool first = true;
  char item[200];
  for (size_t i = 0; i < pendingCount; i++) {
    const qn::Reading& r = pending[i].r;
    const String day = localDate((time_t)r.unixTime);
    snprintf(item, sizeof item,
             "%s{\"date\":\"%s\",\"metric\":\"weight_kg\",\"value\":%.2f,\"unit\":\"kg\",\"source\":\"%s\"}",
             first ? "" : ",", day.c_str(), r.weightKg, kSource);
    body += item;
    first = false;
    if (r.bodyFatPct > 0.f) {
      snprintf(item, sizeof item,
               ",{\"date\":\"%s\",\"metric\":\"body_fat_pct\",\"value\":%.1f,\"unit\":\"%%\",\"source\":\"%s\"}",
               day.c_str(), r.bodyFatPct, kSource);
      body += item;
    }
  }
  body += "]}";

  String resp;
  const int code = postJson(COACH_URL, body, &resp);
  lastPostAt = (uint32_t)time(nullptr);
  lastPostCode = code;
  logf("post %u reading(s): HTTP %d %s", (unsigned)pendingCount, code, resp.substring(0, 120).c_str());
  if (code >= 200 && code < 300) {
    pendingCount = 0;
    savePending();
    led(0, 40, 0);  // green for a few seconds: in Coach
    ledOffAt = millis() + 5000;
    return true;
  }
  if (code == 400 || code == 413) {
    pendingCount = 0;  // the server will never take this batch (COACH-API.md): drop it
    savePending();
  }
  led(40, 0, 0);  // red: not sent; 401 means the token in config.h is wrong
  return false;
}

// ---- Bluetooth -----------------------------------------------------------------------------------------------

String scaleMac;  // the scale we read, remembered across restarts
NimBLEAddress connectTo;
volatile bool wantConnect = false;
uint32_t cooldownUntil = 0;
float lastBroadcastKg = 0.f;
uint32_t lastBroadcastAt = 0;
QueueHandle_t frames;
QueueHandle_t broadcasts;  // weights from broadcast-only scales, handed from the BLE task to loop()

struct Frame {
  uint8_t len;
  uint8_t data[24];
};

bool looksLikeQn(NimBLEAdvertisedDevice* d) {
  if (!scaleMac.isEmpty()) return d->getAddress().toString() == std::string(scaleMac.c_str());
  const std::string name = d->getName();
  return name.find("QN") != std::string::npos || name.find("Renpho") != std::string::npos ||
         name.find("RENPHO") != std::string::npos || d->isAdvertisingService(kFFE0) ||
         d->isAdvertisingService(kFFF0);
}

// Every Bluetooth device heard lately, for the status page: shows whether the scale is in range and how it
// advertises when the bridge does not recognise it.
struct Seen {
  std::string mac, name, data;
  int rssi;
  uint32_t at;
};
constexpr size_t kSeenMax = 12;
Seen seen[kSeenMax];
SemaphoreHandle_t seenLock = xSemaphoreCreateMutex();

void remember(NimBLEAdvertisedDevice* d) {
  if (xSemaphoreTake(seenLock, 0) != pdTRUE) return;
  const std::string mac = d->getAddress().toString();
  size_t slot = kSeenMax;
  for (size_t i = 0; i < kSeenMax && slot == kSeenMax; i++) if (seen[i].mac == mac) slot = i;
  const bool fresh = slot == kSeenMax;
  if (fresh) {
    // A new device takes the oldest slot, Apple's many beacons (4c00) first, so a scale is not pushed out by them.
    auto rank = [](const Seen& e) { return e.at == 0 ? 0 : e.data.rfind("4c00", 0) == 0 ? 1 : 2; };
    slot = 0;
    for (size_t i = 1; i < kSeenMax; i++) {
      const int a = rank(seen[i]), b = rank(seen[slot]);
      if (a < b || (a == b && seen[i].at < seen[slot].at)) slot = i;
    }
  }
  Seen& e = seen[slot];
  e.mac = mac;
  if (d->haveName()) e.name = d->getName();
  else if (fresh) e.name.clear();
  if (d->haveManufacturerData()) {
    const std::string m = d->getManufacturerData();
    e.data = hexOf((const uint8_t*)m.data(), std::min<size_t>(m.size(), 24)).c_str();
  } else {
    e.data.clear();
  }
  e.rssi = d->getRSSI();
  e.at = millis() | 1;
  xSemaphoreGive(seenLock);
}

class ScanCallbacks : public NimBLEAdvertisedDeviceCallbacks {
  void onResult(NimBLEAdvertisedDevice* d) override {
    remember(d);
    if (!d->haveManufacturerData() || wantConnect) return;
    const std::string m = d->getManufacturerData();
    const uint8_t* b = (const uint8_t*)m.data();
    if (qn::isBroadcastAdvertisement(b, m.size())) {
      // Broadcast-only firmware: the weight is in the advertisement, no connection, no impedance.
      const float kg = qn::parseBroadcast(b + 2, m.size() - 2);
      if (kg > 0.f && (fabsf(kg - lastBroadcastKg) > 0.05f || millis() - lastBroadcastAt > 120000)) {
        lastBroadcastKg = kg;
        lastBroadcastAt = millis();
        xQueueSend(broadcasts, &kg, 0);
      }
      return;
    }
    if (!qn::isQnAdvertisement(b, m.size()) || (int32_t)(millis() - cooldownUntil) < 0 || !looksLikeQn(d)) return;
    connectTo = d->getAddress();
    wantConnect = true;
    NimBLEDevice::getScan()->stop();
  }
};

void onNotify(NimBLERemoteCharacteristic*, uint8_t* data, size_t len, bool) {
  Frame f;
  f.len = (uint8_t)min(len, sizeof f.data);
  memcpy(f.data, data, f.len);
  xQueueSend(frames, &f, 0);
}

void startScan() {
  NimBLEScan* scan = NimBLEDevice::getScan();
  if (!scan->isScanning()) scan->start(0, nullptr, false);
}

// The last session, for the heartbeat and the status page.
uint32_t lastSessionAt = 0;   // unix time
uint32_t lastSessionSeq = 0;  // its first log line
const char* lastSessionResult = nullptr;
bool heartbeatDue = false;
uint8_t failedInARow = 0;  // sessions without a reading in a row: back off a little so a flaky link does not spin

// One connection: handshake, final reading, end command. Returns when the scale is done or gone.
void runSession() {
  wantConnect = false;
  lastSessionSeq = logSeq;
  lastSessionAt = timeValid() ? (uint32_t)time(nullptr) : 0;
  const String mac = connectTo.toString().c_str();
  logf("scale %s awake, connecting", mac.c_str());
  led(0, 0, 40);  // blue: talking to the scale
  NimBLEClient* client = NimBLEDevice::createClient();
  client->setConnectTimeout(5);
  xQueueReset(frames);

  NimBLERemoteCharacteristic *write = nullptr, *alt = nullptr;
  bool ok = client->connect(connectTo);
  if (ok) {
    NimBLERemoteService* svc = client->getService(kFFF0);
    if (svc) {
      write = svc->getCharacteristic(kFFF2);
      NimBLERemoteCharacteristic* n = svc->getCharacteristic(kFFF1);
      ok = n && write && n->subscribe(true, onNotify);
    } else if ((svc = client->getService(kFFE0))) {
      write = svc->getCharacteristic(kFFE3);
      alt = svc->getCharacteristic(kFFE4);
      NimBLERemoteCharacteristic* n = svc->getCharacteristic(kFFE1);
      NimBLERemoteCharacteristic* ind = svc->getCharacteristic(kFFE2);
      ok = n && write && n->subscribe(true, onNotify);
      if (ok && ind) ind->subscribe(false, onNotify);  // indications: pre-measurement and stored records
    } else {
      ok = false;
    }
    if (!ok) {
      logf("scale %s: no QN service (FFF0/FFE0). A newer protocol? Send this log.", mac.c_str());
      lastSessionResult = "no-service";
    }
  } else {
    logf("scale %s: connect failed", mac.c_str());
    lastSessionResult = "connect-failed";
  }

  bool gotReading = false;
  if (ok) {
    qn::Session session(profile(), timeValid() ? (uint32_t)time(nullptr) : 0);
    const uint32_t start = millis();
    uint32_t lastFrame = millis();
    bool fallbackSent = false, done = false;
    uint32_t doneAt = 0;
    while (client->isConnected() && millis() - start < kSessionTimeoutMs) {
      Frame f;
      if (xQueueReceive(frames, &f, pdMS_TO_TICKS(100)) == pdTRUE) {
        lastFrame = millis();
        logf("rx %s", hexOf(f.data, f.len).c_str());
        const qn::Actions a = session.onFrame(f.data, f.len);
        for (size_t i = 0; i < a.writeCount; i++) {
          const qn::Write& w = a.writes[i];
          // On FFE0 scales the clock and stored-record commands go to FFE4.
          NimBLERemoteCharacteristic* to = (alt && (w.bytes[0] == 0x20 || w.bytes[0] == 0x22)) ? alt : write;
          logf("tx %s", hexOf(w.bytes, w.len).c_str());
          if (!to->writeValue(w.bytes, w.len, true)) logf("write failed");
        }
        for (size_t i = 0; i < a.readingCount; i++) {
          enqueue(a.readings[i]);
          gotReading = true;
        }
        if (a.droppedClock) {
          logf("skipped %u stored reading(s) taken while the scale's clock was reset (new batteries); its clock is set now",
               (unsigned)a.droppedClock);
        }
        if (a.droppedStored > a.droppedClock) {
          logf("skipped %u stored reading(s): older than 30 days or in the future", (unsigned)(a.droppedStored - a.droppedClock));
        }
        if (a.done && !done) {
          done = true;
          doneAt = millis();
        }
      } else if (!fallbackSent && session.sawFrame() && millis() - lastFrame > kQuietFallbackMs && !done) {
        // Some QN firmware waits for a "current time" write before it streams (qn-scale PROTOCOL.md).
        fallbackSent = true;
        const qn::Write w = session.currentTimeCommand();
        logf("scale quiet, tx %s", hexOf(w.bytes, w.len).c_str());
        (alt ? alt : write)->writeValue(w.bytes, w.len, true);
      }
      if (done && millis() - doneAt > 1500) break;  // let stored records and the end command finish
    }
    if (!done && !gotReading) {
      logf("scale disconnected before a final reading; reconnecting to collect it as a stored reading");
    }
    lastSessionResult = gotReading ? "reading" : "no-reading";
  }
  if (client->isConnected()) client->disconnect();
  NimBLEDevice::deleteClient(client);
  // After a reading the scale keeps advertising for a while: ignore it. Without one, it is often still measuring
  // (it dropped us mid-way, or we connected too early), and it stores the result: connect again straight away.
  failedInARow = gotReading ? 0 : (uint8_t)min(failedInARow + 1, 20);
  cooldownUntil = millis() + (gotReading ? kCooldownMs : failedInARow > 4 ? 10000 : kRetryCooldownMs);
  heartbeatDue = true;

  if (gotReading && scaleMac.isEmpty()) {
    scaleMac = mac;
    prefs.putString("scale_mac", scaleMac);
    logf("remembered scale %s", scaleMac.c_str());
  }
  led(0, 0, 0);
}

// ---- health: the heartbeat to Coach and /status.json ---------------------------------------------------------

uint32_t bootCount = 0;
const char* resetReason = "unknown";
uint32_t lastHeartbeat = 0;  // millis of the last attempt

const char* resetReasonText(esp_reset_reason_t r) {
  switch (r) {
    case ESP_RST_POWERON: return "power on";
    case ESP_RST_SW: return "software (update or restart)";
    case ESP_RST_PANIC: return "crash";
    case ESP_RST_INT_WDT:
    case ESP_RST_TASK_WDT:
    case ESP_RST_WDT: return "watchdog";
    case ESP_RST_BROWNOUT: return "brownout (weak USB power)";
    case ESP_RST_DEEPSLEEP: return "deep sleep";
    default: return "other";
  }
}

// The bridge's health as JSON: the heartbeat body (src/lib/vitals/scale.mjs heartbeatFrom) and /status.json.
String statusJson() {
  String j = "{";
  j += "\"firmware\":" + jsonString(FW_VERSION);
  j += ",\"uptimeS\":" + String(millis() / 1000);
  j += ",\"bootCount\":" + String(bootCount);
  j += ",\"resetReason\":" + jsonString(resetReason);
  if (WiFi.status() == WL_CONNECTED) {
    j += ",\"rssi\":" + String(WiFi.RSSI());
    j += ",\"ip\":" + jsonString(WiFi.localIP().toString());
  }
  if (!scaleMac.isEmpty()) j += ",\"scaleMac\":" + jsonString(scaleMac);
  j += ",\"pending\":" + String(pendingCount);
  if (lastSessionResult) {
    j += ",\"lastSession\":{\"at\":" + String(lastSessionAt) + ",\"result\":" + jsonString(lastSessionResult) + ",\"log\":[";
    bool first = true;
    linesSince(lastSessionSeq, 40, [&](const String& line) {
      if (!first) j += ",";
      j += jsonString(line);
      first = false;
    });
    j += "]}";
  }
  if (lastPostAt) j += ",\"lastPost\":{\"at\":" + String(lastPostAt) + ",\"code\":" + String(lastPostCode) + "}";
  return j + "}";
}

void sendHeartbeat() {
  lastHeartbeat = millis();
  heartbeatDue = false;
  if (WiFi.status() != WL_CONNECTED || !timeValid()) return;
  const int code = postJson(COACH_HEARTBEAT_URL, statusJson(), nullptr);
  // Quiet when it works: the log is for weigh-ins. A failure shows up once per failing streak.
  static int lastCode = 200;
  if ((code < 200 || code >= 300) && code != lastCode) logf("heartbeat to Coach failed: HTTP %d", code);
  if (code >= 200 && code < 300 && (lastCode < 200 || lastCode >= 300)) logf("heartbeat to Coach OK");
  lastCode = code;
}

// ---- web page, Wi-Fi, OTA ------------------------------------------------------------------------------------

WebServer web(80);

void handleRoot() {
  String s = "Scale bridge\n\n";
  s += "Wi-Fi: " + (WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() + " (" + String(WiFi.RSSI()) + " dBm)" : String("not connected")) + "\n";
  s += "Clock: " + String(timeValid() ? "set" : "not set yet") + "\n";
  s += "Scale: " + (scaleMac.isEmpty() ? String("not seen yet") : scaleMac) + "\n";
  s += "Waiting to post: " + String(pendingCount) + "\n";
  if (lastReading.weightKg > 0.f) {
    s += "Last reading: " + String(lastReading.weightKg, 2) + " kg, body fat " + String(lastReading.bodyFatPct, 1) + " %\n";
  }
  s += "Uptime: " + String(millis() / 60000) + " min (boot " + String(bootCount) + ", last restart: " + resetReason + ")\n";
  s += "Firmware: " + String(FW_VERSION) + "\n";
  if (lastPostAt) s += "Last post to Coach: HTTP " + String(lastPostCode) + "\n";
  s += "\nBluetooth heard in the last 5 min (step on the scale; it should appear here):\n";
  if (xSemaphoreTake(seenLock, pdMS_TO_TICKS(100)) == pdTRUE) {
    size_t n = 0;
    for (const Seen& e : seen) {
      if (e.at == 0 || millis() - e.at > 300000) continue;
      n++;
      s += "  " + String(e.mac.c_str()) + "  " + String(e.rssi) + " dBm  " + String((millis() - e.at) / 1000) + " s ago  " +
           (e.name.empty() ? String("(no name)") : String(e.name.c_str())) + (e.data.empty() ? String("") : "  data " + String(e.data.c_str())) + "\n";
    }
    xSemaphoreGive(seenLock);
    if (!n) s += "  nothing\n";
  }
  s += "\nLog (newest last):\n";
  for (size_t i = 0; i < kLogLines; i++) {
    const String& line = logRing[(logHead + i) % kLogLines];
    if (!line.isEmpty()) s += line + "\n";
  }
  web.send(200, "text/plain; charset=utf-8", s);
}

void handleForget() {
  scaleMac = "";
  prefs.remove("scale_mac");
  logf("forgot the scale; the next QN scale seen will be remembered");
  web.send(200, "text/plain", "Forgot the scale.\n");
}

void handleStatusJson() { web.send(200, "application/json", statusJson()); }

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(kHostname);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

}  // namespace

void setup() {
  Serial.begin(115200);
  // The time zone first: the clock survives a software restart, so the first log line already has a time.
  setenv("TZ", TIMEZONE, 1);
  tzset();
  delay(300);
  led(20, 20, 20);
  frames = xQueueCreate(32, sizeof(Frame));
  broadcasts = xQueueCreate(4, sizeof(float));
  prefs.begin("scale-bridge", false);
  scaleMac = String(SCALE_MAC).length() ? String(SCALE_MAC) : prefs.getString("scale_mac", "");
  scaleMac.toLowerCase();
  lastLiveUnix = prefs.getUInt("last_live", 0);
  bootCount = prefs.getUInt("boots", 0) + 1;
  prefs.putUInt("boots", bootCount);
  resetReason = resetReasonText(esp_reset_reason());
  loadPending();
  logf("scale bridge %s starting (%s); scale %s", FW_VERSION, resetReason, scaleMac.isEmpty() ? "not known yet" : scaleMac.c_str());
  if (pendingCount) logf("%u reading(s) from before the restart still to post", (unsigned)pendingCount);

  connectWifi();
  configTzTime(TIMEZONE, "pool.ntp.org", "time.google.com");

  ArduinoOTA.setHostname(kHostname);
  ArduinoOTA.setPassword(OTA_PASSWORD);
  ArduinoOTA.onStart([] { NimBLEDevice::getScan()->stop(); logf("update starting"); });
  ArduinoOTA.begin();  // also starts mDNS as scale-bridge.local
  MDNS.addService("http", "tcp", 80);
  web.on("/", handleRoot);
  web.on("/forget", handleForget);
  web.on("/status.json", handleStatusJson);
  web.begin();

  NimBLEDevice::init(kHostname);
  NimBLEScan* scan = NimBLEDevice::getScan();
  scan->setAdvertisedDeviceCallbacks(new ScanCallbacks(), true);  // duplicates on: broadcast scales update in place
  scan->setActiveScan(true);  // names arrive in scan responses
  scan->setInterval(100);
  scan->setWindow(90);
  startScan();
  led(0, 0, 0);
}

void loop() {
  static uint32_t lastTry = 0;
  static bool wasOnline = false;
  static uint32_t offlineSince = 0, lastKick = 0;
  static bool firstHeartbeat = true;
  ArduinoOTA.handle();
  web.handleClient();

  const bool online = WiFi.status() == WL_CONNECTED;
  if (online != wasOnline) {
    wasOnline = online;
    if (online) logf("Wi-Fi connected, %s (%d dBm)", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    else logf("Wi-Fi lost");
    offlineSince = online ? 0 : millis();
    if (online) lastTry = 0;  // post what waited
  }
  // Wi-Fi watchdog: auto-reconnect sometimes stalls after a router restart. Kick it, then restart the board.
  if (!online) {
    if (!offlineSince) offlineSince = millis();
    if (millis() - offlineSince > kWifiKickMs && millis() - lastKick > 30000) {
      lastKick = millis();
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
    if (millis() - offlineSince > kWifiRestartMs && !wantConnect) {
      logf("no Wi-Fi for 10 min: restarting");
      delay(200);
      ESP.restart();
    }
  }
  // Health report: once the clock is set after boot, after each session, then every 15 minutes.
  if (online && timeValid() && (firstHeartbeat || (heartbeatDue && pendingCount == 0) || millis() - lastHeartbeat > kHeartbeatMs)) {
    firstHeartbeat = false;
    sendHeartbeat();
  }

  float kg;
  if (xQueueReceive(broadcasts, &kg, 0) == pdTRUE) {
    qn::Reading r;
    r.weightKg = kg;
    enqueue(r);
    lastTry = 0;
  }
  if (ledOffAt && millis() > ledOffAt) {
    ledOffAt = 0;
    led(0, 0, 0);
  }

  if (wantConnect) {
    runSession();
    startScan();
    lastTry = 0;  // post right away
  }

  if (pendingCount > 0 && (lastTry == 0 || millis() - lastTry > kRetryMs)) {
    lastTry = millis();
    postPending();
  }
  // NimBLE stops a continuous scan on some errors; keep it running.
  if (!wantConnect) startScan();
  delay(10);
}
