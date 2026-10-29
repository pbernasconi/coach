// Scale bridge: reads the Renpho Elis 1 over Bluetooth and posts each weigh-in to Coach over Wi-Fi.
//
// Loop: scan for the scale; when it wakes (someone stepped on), connect, answer its handshake (lib/qn), take the
// final reading, disconnect, then post weight_kg and body_fat_pct for that day to POST /api/vitals/sync.
// Readings wait in flash and are retried every minute while Coach or Wi-Fi is down, also across a restart.
// http://scale-bridge.local/ shows the state and the last 80 log lines (and the lines from before the last
// restart); /status.json has the same for scripts. Watchdogs restart Wi-Fi, the Bluetooth scan or the board when
// one of them stops working.
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
#include <esp_task_wdt.h>
#include <time.h>

#include "certs.h"
#include "qn.h"

#if __has_include("config.h")
#include "config.h"
#else
#error "Copy include/config.example.h to include/config.h and fill it in (README.md)."
#endif

namespace {

constexpr const char* kHostname = "scale-bridge";
constexpr const char* kSource = "Renpho Elis 1 (scale bridge)";
constexpr uint32_t kSessionTimeoutMs = 45000;  // the scale sleeps well before this
constexpr uint32_t kQuietFallbackMs = 3000;    // no frame this long after the unit reply: send "current time"
constexpr uint32_t kCooldownMs = 15000;        // after a reading: ignore the scale's leftover advertising
constexpr uint32_t kRetryCooldownMs = 800;     // after a session with no reading: the scale may still be measuring
constexpr uint32_t kHeartbeatMs = 15 * 60000;  // health report to Coach (POST /api/vitals/sync/bridge)
constexpr uint32_t kRetryMs = 60000;
constexpr size_t kMaxPending = 24;
constexpr uint32_t kTaskWatchdogS = 90;          // loop() stuck this long (a hung TLS or BLE call): restart
constexpr uint32_t kWifiKickMs = 60000;          // offline this long: disconnect and join again
constexpr uint32_t kWifiRestartMs = 20 * 60000;  // offline this long: restart the board
constexpr uint32_t kScanKickMs = 3 * 60000;      // no advertisement at all this long: restart the scan
constexpr uint32_t kScanRestartMs = 10 * 60000;  // still nothing: restart the board
constexpr uint32_t kMinFreeHeap = 24000;         // below this: restart before an allocation fails
const char* const kBuilt = __DATE__ " " __TIME__;

// The QN service layouts (renpho-escs20m const.py). Renpho uses FFF0; some rebrands use FFE0.
const NimBLEUUID kFFF0("fff0"), kFFF1("fff1"), kFFF2("fff2");
const NimBLEUUID kFFE0("ffe0"), kFFE1("ffe1"), kFFE2("ffe2"), kFFE3("ffe3"), kFFE4("ffe4");

// ---- log: Serial plus a ring buffer for the web page --------------------------------------------------------

constexpr size_t kLogLines = 80;
String logRing[kLogLines];
size_t logHead = 0;

// The newest lines also go to RTC memory, which keeps its contents through a software restart, a crash or a
// watchdog reset (not through a power cut). After a restart they show as "before the last restart".
constexpr size_t kKeptLines = 24, kKeptLen = 160;
constexpr uint32_t kKeptMagic = 0x5CA1E001;
RTC_NOINIT_ATTR uint32_t keptMagic;
RTC_NOINIT_ATTR uint32_t keptHead;
RTC_NOINIT_ATTR char kept[kKeptLines][kKeptLen];
String previousLog[kKeptLines];

void takeKeptLog() {
  if (keptMagic == kKeptMagic && keptHead < kKeptLines) {
    for (size_t i = 0; i < kKeptLines; i++) {
      char* line = kept[(keptHead + i) % kKeptLines];
      line[kKeptLen - 1] = 0;
      previousLog[i] = String(line);
    }
  }
  memset(kept, 0, sizeof kept);
  keptHead = 0;
  keptMagic = kKeptMagic;
}

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
  if (keptMagic == kKeptMagic) {
    strlcpy(kept[keptHead], line.c_str(), kKeptLen);
    keptHead = (keptHead + 1) % kKeptLines;
  }
}

const char* resetReason() {
  switch (esp_reset_reason()) {
    case ESP_RST_POWERON: return "power on";
    case ESP_RST_SW: return "restart by the firmware";
    case ESP_RST_PANIC: return "crash";
    case ESP_RST_INT_WDT:
    case ESP_RST_TASK_WDT:
    case ESP_RST_WDT: return "watchdog";
    case ESP_RST_BROWNOUT: return "brownout (weak power)";
    case ESP_RST_DEEPSLEEP: return "deep sleep";
    default: return "other";
  }
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
constexpr const char* kPendingKey = "pending2";  // a new name when Reading changes layout

// The waiting readings live in flash too, so a restart (watchdog, update, power cut) does not lose a weigh-in.
void savePending() {
  if (pendingCount) prefs.putBytes(kPendingKey, pending, sizeof(Pending) * pendingCount);
  else prefs.remove(kPendingKey);
}

void loadPending() {
  prefs.remove("pending");  // an older layout, if any
  const size_t n = prefs.getBytesLength(kPendingKey);
  if (n == 0 || n % sizeof(Pending) != 0 || n > sizeof pending) return;
  prefs.getBytes(kPendingKey, pending, n);
  pendingCount = n / sizeof(Pending);
}

// For the status page.
uint32_t lastPostAt = 0;  // unix time
int lastPostCode = 0;
String lastPostReply;
uint32_t lastSessionAt = 0;  // unix time
String lastSessionResult = "none since the restart";
uint32_t lastSessionSeq = 0;  // the session's first log line, for the heartbeat
bool haveSession = false;
bool heartbeatDue = false;
uint8_t failedInARow = 0;  // sessions without a reading in a row
uint32_t ledOffAt = 0;
uint32_t lastLiveUnix = 0;  // newest live weigh-in sent: older stored readings must not overwrite its day

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
  savePending();
  lastReading = r;
  logf("%s reading: %.2f kg, body fat %.1f %%, impedance %u%s", r.stored ? "stored" : "live", r.weightKg,
       r.bodyFatPct, r.impedance, r.estimatedTime ? " (time worked out: the scale's clock was reset)" : "");
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

  WiFiClientSecure tls;
  tls.setCACert(kRootCAs);
  tls.setHandshakeTimeout(20);  // seconds; the default (120) is longer than the task watchdog
  HTTPClient http;
  http.setConnectTimeout(10000);
  http.setTimeout(15000);
  if (!http.begin(tls, COACH_URL)) {
    logf("post: bad COACH_URL");
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + COACH_TOKEN);
  const int code = http.POST(body);
  const String resp = http.getString();
  http.end();
  logf("post %u reading(s): HTTP %d %s", (unsigned)pendingCount, code,
       code < 0 ? http.errorToString(code).c_str() : resp.substring(0, 120).c_str());
  lastPostAt = (uint32_t)time(nullptr);
  lastPostCode = code;
  lastPostReply = code < 0 ? http.errorToString(code) : resp.substring(0, 120);
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
QueueHandle_t broadcasts;
volatile uint32_t lastAdvAt = 0;        // any advertisement: the scan is alive
volatile uint32_t scaleHeardAt = 0;     // the remembered scale's last advertisement (millis)
volatile int scaleRssi = 0;  // weights from broadcast-only scales, handed from the BLE task to loop()

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
constexpr size_t kSeenMax = 16;
Seen seen[kSeenMax];
SemaphoreHandle_t seenLock = xSemaphoreCreateMutex();

void remember(NimBLEAdvertisedDevice* d) {
  if (xSemaphoreTake(seenLock, 0) != pdTRUE) return;
  const std::string mac = d->getAddress().toString();
  size_t slot = kSeenMax;
  for (size_t i = 0; i < kSeenMax && slot == kSeenMax; i++) if (seen[i].mac == mac) slot = i;
  const bool fresh = slot == kSeenMax;
  if (fresh) {  // a new device takes the oldest slot, never the scale's
    const std::string scale = scaleMac.c_str();
    for (size_t i = 0; i < kSeenMax; i++) {
      if (!scale.empty() && seen[i].mac == scale) continue;
      if (slot == kSeenMax || seen[i].at < seen[slot].at) slot = i;
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
    lastAdvAt = millis();
    remember(d);
    if (!scaleMac.isEmpty() && d->getAddress().toString() == std::string(scaleMac.c_str())) {
      scaleHeardAt = millis() | 1;
      scaleRssi = d->getRSSI();
    }
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

// One connection: handshake, final reading, end command. Returns when the scale is done or gone.
void runSession() {
  wantConnect = false;
  lastSessionSeq = logSeq;
  haveSession = true;
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
    if (!ok) logf("scale %s: no QN service (FFF0/FFE0). A newer protocol? Send this log.", mac.c_str());
  } else {
    logf("scale %s: connect failed", mac.c_str());
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
        if (a.droppedStored) logf("skipped %u stored reading(s): older than 30 days or not a weight", (unsigned)a.droppedStored);
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
      esp_task_wdt_reset();
    }
    const qn::Actions late = session.finish();
    for (size_t i = 0; i < late.readingCount; i++) {
      enqueue(late.readings[i]);
      gotReading = true;
    }
    if (late.droppedStored) {
      logf("skipped %u stored reading(s) from a reset scale clock: %s", (unsigned)late.droppedStored,
           done ? "a live reading came too, so their time is unknown" : "the bridge clock is not set yet");
    }
    char result[96];
    snprintf(result, sizeof result, "%s, %u stored record(s), %s", done ? "live reading" : "no live reading",
             (unsigned)session.storedCount(), gotReading ? "weigh-in queued" : "nothing to send");
    lastSessionResult = result;
    logf("session ended: %s", result);
    if (!done && !gotReading) logf("no weigh-in: step on again and stay until the number flashes");
  } else {
    lastSessionResult = "could not talk to the scale";
  }
  lastSessionAt = (uint32_t)time(nullptr);
  if (client->isConnected()) client->disconnect();
  NimBLEDevice::deleteClient(client);
  // After a reading the scale keeps advertising for a while: ignore it. Without one it is often still measuring
  // (it dropped the link mid-way on 2026-10-29) and stores the result, so connect again at once to collect it.
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

// ---- web page, Wi-Fi, OTA ------------------------------------------------------------------------------------

WebServer web(80);

String ago(uint32_t at) {
  if (!at) return "never";
  const uint32_t s = (millis() - at) / 1000;
  if (s < 120) return String(s) + " s ago";
  if (s < 7200) return String(s / 60) + " min ago";
  return String(s / 3600) + " h ago";
}

String when(uint32_t unix) {
  if (!unix) return "never";
  const time_t t = unix;
  struct tm tm;
  localtime_r(&t, &tm);
  char b[24];
  strftime(b, sizeof b, "%m-%d %H:%M:%S", &tm);
  return String(b);
}

uint32_t bootCount = 0;

void handleRoot() {
  String s = "Scale bridge\n\n";
  s += "Wi-Fi: " + (WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() + " (" + String(WiFi.RSSI()) + " dBm)" : String("not connected")) + "\n";
  s += "Clock: " + (timeValid() ? when((uint32_t)time(nullptr)) : String("not set yet")) + "\n";
  s += "Scale: " + (scaleMac.isEmpty() ? String("not seen yet") : scaleMac + ", heard " + ago(scaleHeardAt) +
                    (scaleHeardAt ? " at " + String(scaleRssi) + " dBm" : String(""))) + "\n";
  s += "Last session: " + (lastSessionAt ? when(lastSessionAt) + ", " : String("")) + lastSessionResult + "\n";
  s += "Waiting to post: " + String(pendingCount) + "\n";
  s += "Last post: " + (lastPostAt ? when(lastPostAt) + ", HTTP " + String(lastPostCode) + " " + lastPostReply : String("none since the restart")) + "\n";
  if (lastReading.weightKg > 0.f) {
    s += "Last reading: " + String(lastReading.weightKg, 2) + " kg, body fat " + String(lastReading.bodyFatPct, 1) + " %, " +
         when(lastReading.unixTime) + "\n";
  }
  s += "Firmware: built " + String(kBuilt) + ", height " + String(PROFILE_HEIGHT_CM) + " cm\n";
  s += "Restart #" + String(bootCount) + ": " + resetReason() + ", up " + String(millis() / 60000) + " min, free memory " +
       String(ESP.getFreeHeap() / 1024) + " KB (lowest " + String(ESP.getMinFreeHeap() / 1024) + " KB)\n";
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
  bool any = false;
  for (const String& line : previousLog) any = any || !line.isEmpty();
  if (any) {
    s += "\nLog before the last restart:\n";
    for (const String& line : previousLog) if (!line.isEmpty()) s += line + "\n";
  }
  s += "\nLog (newest last):\n";
  for (size_t i = 0; i < kLogLines; i++) {
    const String& line = logRing[(logHead + i) % kLogLines];
    if (!line.isEmpty()) s += line + "\n";
  }
  web.send(200, "text/plain; charset=utf-8", s);
}

String jsonEscape(const String& in) {
  String o;
  for (size_t i = 0; i < in.length(); i++) {
    const char ch = in[i];
    if (ch == '"' || ch == '\\') o += '\\';
    if ((uint8_t)ch < 0x20) continue;
    o += ch;
  }
  return o;
}

void handleJson() {
  String s = "{";
  s += "\"wifiConnected\":" + String(WiFi.status() == WL_CONNECTED ? "true" : "false");
  s += ",\"rssi\":" + String(WiFi.RSSI());
  s += ",\"clockSet\":" + String(timeValid() ? "true" : "false");
  s += ",\"scale\":\"" + scaleMac + "\"";
  s += ",\"scaleHeardSecondsAgo\":" + (scaleHeardAt ? String((millis() - scaleHeardAt) / 1000) : String("null"));
  s += ",\"lastSessionAt\":" + String(lastSessionAt) + ",\"lastSession\":\"" + jsonEscape(lastSessionResult) + "\"";
  s += ",\"pending\":" + String(pendingCount);
  s += ",\"lastPostAt\":" + String(lastPostAt) + ",\"lastPostCode\":" + String(lastPostCode);
  s += ",\"lastWeightKg\":" + String(lastReading.weightKg, 2) + ",\"lastReadingAt\":" + String(lastReading.unixTime);
  s += ",\"built\":\"" + String(kBuilt) + "\",\"boot\":" + String(bootCount) + ",\"resetReason\":\"" + resetReason() + "\"";
  s += ",\"uptimeSeconds\":" + String(millis() / 1000) + ",\"freeHeap\":" + String(ESP.getFreeHeap());
  s += ",\"minFreeHeap\":" + String(ESP.getMinFreeHeap()) + "}";
  web.send(200, "application/json", s);
}

// ---- health report to Coach (src/lib/vitals/scale.mjs heartbeatFrom; Settings > Bathroom scale) ---------------

#ifndef COACH_HEARTBEAT_URL
#define COACH_HEARTBEAT_URL COACH_URL "/bridge"  // https://…/api/vitals/sync/bridge
#endif

uint32_t lastHeartbeat = 0;  // millis of the last attempt

String heartbeatJson() {
  String j = "{\"firmware\":\"" + jsonEscape(kBuilt) + "\"";
  j += ",\"uptimeS\":" + String(millis() / 1000) + ",\"bootCount\":" + String(bootCount);
  j += ",\"resetReason\":\"" + jsonEscape(resetReason()) + "\"";
  if (WiFi.status() == WL_CONNECTED) {
    j += ",\"rssi\":" + String(WiFi.RSSI()) + ",\"ip\":\"" + WiFi.localIP().toString() + "\"";
  }
  if (!scaleMac.isEmpty()) j += ",\"scaleMac\":\"" + jsonEscape(scaleMac) + "\"";
  j += ",\"pending\":" + String(pendingCount);
  if (haveSession) {
    j += ",\"lastSession\":{\"at\":" + String(lastSessionAt) + ",\"result\":\"" + jsonEscape(lastSessionResult) + "\",\"log\":[";
    uint32_t n = logSeq - lastSessionSeq;
    if (n > kLogLines) n = kLogLines;
    if (n > 40) n = 40;
    for (uint32_t i = n; i > 0; i--) {
      j += "\"" + jsonEscape(logRing[(logHead + kLogLines - i) % kLogLines]) + "\"";
      if (i > 1) j += ",";
    }
    j += "]}";
  }
  if (lastPostAt) j += ",\"lastPost\":{\"at\":" + String(lastPostAt) + ",\"code\":" + String(lastPostCode) + "}";
  return j + "}";
}

void sendHeartbeat() {
  lastHeartbeat = millis();
  heartbeatDue = false;
  if (WiFi.status() != WL_CONNECTED || !timeValid()) return;
  WiFiClientSecure tls;
  tls.setCACert(kRootCAs);
  tls.setHandshakeTimeout(20);  // under the task watchdog
  HTTPClient http;
  http.setConnectTimeout(10000);
  http.setTimeout(15000);
  if (!http.begin(tls, COACH_HEARTBEAT_URL)) return;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + COACH_TOKEN);
  const int code = http.POST(heartbeatJson());
  http.end();
  // Quiet while it works: one line when it starts failing and one when it recovers.
  static int lastCode = 200;
  const bool ok = code >= 200 && code < 300, wasOk = lastCode >= 200 && lastCode < 300;
  if (!ok && (wasOk || code != lastCode)) logf("health report to Coach failed: HTTP %d", code);
  if (ok && !wasOk) logf("health report to Coach OK again");
  lastCode = code;
}

void handleRestart() {
  logf("restart asked for on the web page");
  web.send(200, "text/plain", "Restarting.\n");
  delay(300);
  ESP.restart();
}

void handleForget() {
  scaleMac = "";
  prefs.remove("scale_mac");
  logf("forgot the scale; the next QN scale seen will be remembered");
  web.send(200, "text/plain", "Forgot the scale.\n");
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.setHostname(kHostname);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(300);
  setenv("TZ", TIMEZONE, 1);  // before the first log line: the clock survives a software restart
  tzset();
  takeKeptLog();
  led(20, 20, 20);
  frames = xQueueCreate(32, sizeof(Frame));
  broadcasts = xQueueCreate(4, sizeof(float));
  prefs.begin("scale-bridge", false);
  scaleMac = String(SCALE_MAC).length() ? String(SCALE_MAC) : prefs.getString("scale_mac", "");
  scaleMac.toLowerCase();
  lastLiveUnix = prefs.getUInt("last_live", 0);
  bootCount = prefs.getUInt("boots", 0) + 1;
  prefs.putUInt("boots", bootCount);
  loadPending();
  logf("scale bridge starting (restart #%u: %s, built %s); scale %s; %u reading(s) waiting", (unsigned)bootCount,
       resetReason(), kBuilt, scaleMac.isEmpty() ? "not known yet" : scaleMac.c_str(), (unsigned)pendingCount);

  connectWifi();
  configTzTime(TIMEZONE, "pool.ntp.org", "time.google.com");

  ArduinoOTA.setHostname(kHostname);
  ArduinoOTA.setPassword(OTA_PASSWORD);
  ArduinoOTA.onStart([] {
    NimBLEDevice::getScan()->stop();
    esp_task_wdt_delete(nullptr);  // the upload blocks loop() for longer than the watchdog allows
    logf("update starting");
  });
  ArduinoOTA.onEnd([] { logf("update written, restarting"); });
  ArduinoOTA.onError([](ota_error_t e) {
    logf("update failed (error %u)", (unsigned)e);
    esp_task_wdt_add(nullptr);
  });
  ArduinoOTA.begin();  // also starts mDNS as scale-bridge.local
  MDNS.addService("http", "tcp", 80);
  web.on("/", handleRoot);
  web.on("/forget", handleForget);
  web.on("/status.json", handleJson);
  web.on("/restart", handleRestart);
  web.begin();

  NimBLEDevice::init(kHostname);
  NimBLEScan* scan = NimBLEDevice::getScan();
  scan->setAdvertisedDeviceCallbacks(new ScanCallbacks(), true);  // duplicates on: broadcast scales update in place
  scan->setActiveScan(true);  // names arrive in scan responses
  scan->setInterval(100);
  scan->setWindow(90);
  startScan();
  lastAdvAt = millis();
  esp_task_wdt_init(kTaskWatchdogS, true);  // panics (and so restarts) when loop() stops feeding it
  esp_task_wdt_add(nullptr);
  led(0, 0, 0);
}

// Wi-Fi, scan and memory checks, once a second. Each one first tries a soft fix, then restarts the board; the
// waiting readings are in flash, so a restart loses nothing.
void watchdogs() {
  static uint32_t lastCheck = 0, offlineSince = 0, lastKick = 0, lastScanKick = 0, lastClear = 0;
  if (millis() - lastCheck < 1000) return;
  lastCheck = millis();

  if (WiFi.status() == WL_CONNECTED) {
    offlineSince = 0;
  } else {
    if (!offlineSince) offlineSince = millis();
    const uint32_t off = millis() - offlineSince;
    if (off > kWifiRestartMs) {
      logf("Wi-Fi down for %u min: restarting", (unsigned)(off / 60000));
      delay(200);
      ESP.restart();
    }
    if (off > kWifiKickMs && millis() - lastKick > kWifiKickMs) {
      lastKick = millis();
      logf("Wi-Fi down for %u s: joining again", (unsigned)(off / 1000));
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }

  const uint32_t quiet = millis() - lastAdvAt;
  if (!wantConnect && quiet > kScanRestartMs) {
    logf("no Bluetooth advertisement for %u min: restarting", (unsigned)(quiet / 60000));
    delay(200);
    ESP.restart();
  }
  if (!wantConnect && quiet > kScanKickMs && millis() - lastScanKick > kScanKickMs) {
    lastScanKick = millis();
    logf("no Bluetooth advertisement for %u s: restarting the scan", (unsigned)(quiet / 1000));
    NimBLEScan* scan = NimBLEDevice::getScan();
    scan->stop();
    scan->clearResults();
    startScan();
  }
  // The continuous scan keeps every device it has heard (phones change their address every few minutes), so the
  // list grows until the memory runs out. Clear it every 5 min; stop first, because the scan writes to it.
  if (!wantConnect && millis() - lastClear > 300000) {
    lastClear = millis();
    NimBLEScan* scan = NimBLEDevice::getScan();
    scan->stop();
    scan->clearResults();
    startScan();
  }

  if (ESP.getFreeHeap() < kMinFreeHeap) {
    logf("free memory down to %u bytes: restarting", (unsigned)ESP.getFreeHeap());
    delay(200);
    ESP.restart();
  }
}

void loop() {
  static uint32_t lastTry = 0;
  static bool wasOnline = false;
  esp_task_wdt_reset();
  ArduinoOTA.handle();
  web.handleClient();
  watchdogs();

  static bool clockLogged = false;
  if (!clockLogged && timeValid()) {
    clockLogged = true;
    logf("clock set");
  }
  const bool online = WiFi.status() == WL_CONNECTED;
  if (online != wasOnline) {
    wasOnline = online;
    logf(online ? "Wi-Fi connected, %s" : "Wi-Fi lost%s", online ? WiFi.localIP().toString().c_str() : "");
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
  // Health report: once the clock is set after boot, after each session (once its weigh-in is posted), then
  // every 15 minutes.
  static bool firstHeartbeat = true;
  if (online && timeValid() && (firstHeartbeat || (heartbeatDue && pendingCount == 0) || millis() - lastHeartbeat > kHeartbeatMs)) {
    firstHeartbeat = false;
    esp_task_wdt_reset();
    sendHeartbeat();
  }
  // NimBLE stops a continuous scan on some errors; keep it running.
  if (!wantConnect) startScan();
  delay(10);
}
