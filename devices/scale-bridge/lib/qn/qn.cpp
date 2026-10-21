#include "qn.h"

#include <math.h>
#include <string.h>

namespace qn {

namespace {

// Frame opcodes (byte 0).
constexpr uint8_t kMeasurement = 0x10;
constexpr uint8_t kUnitRequest = 0x12;
constexpr uint8_t kInitRequest = 0x14;
constexpr uint8_t kPreMeasurement = 0x21;
constexpr uint8_t kStored = 0x23;
constexpr uint8_t kProfileAck = 0xA1;

// Frame lengths (byte 1) that tell the two Renpho flavors apart.
constexpr uint8_t kLenExtended = 0x0E;      // body fat worked out on the scale from our profile
constexpr uint8_t kLenExtendedLong = 0x0F;  // same layout, one extra byte (R-MSB01)
constexpr uint8_t kLenBasic = 0x0B;         // weight and impedance only
constexpr uint8_t kLenExtendedPre = 0x05;   // the scale asks for a profile
constexpr uint8_t kLenStored = 0x13;

constexpr uint8_t kRenphoVendor = 0xFF;

uint16_t be16(const uint8_t* p) { return (uint16_t)((p[0] << 8) | p[1]); }
uint32_t le32(const uint8_t* p) { return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24); }

float roundTenth(float x) { return floorf(x * 10.f + 0.5f) / 10.f; }

bool plausibleWeight(float kg) { return kg >= 20.f && kg <= 300.f; }

}  // namespace

void Actions::write(const uint8_t* b, size_t n) {
  if (writeCount >= kMaxWrites || n > kMaxWrite) return;
  memcpy(writes[writeCount].bytes, b, n);
  writes[writeCount].len = n;
  writeCount++;
}

void Actions::reading(const Reading& r) {
  if (readingCount < kMaxReadings) readings[readingCount++] = r;
}

uint8_t checksum(const uint8_t* b, size_t n) {
  uint32_t sum = 0;
  for (size_t i = 0; i < n; i++) sum += b[i];
  return (uint8_t)(sum & 0xFF);
}

float bodyFat(float weightKg, float heightM, int age, Sex sex, uint16_t impedance) {
  if (weightKg <= 0.f || heightM < 1.0f || heightM > 2.5f || age < 10 || age > 100 || impedance == 0) return 0.f;
  const float bmi = weightKg / (heightM * heightM);
  // (c_BMI, c_age, c_int) for algorithm 0x04, non-athlete.
  const float cBmi = sex == Sex::Male ? 1.524f : 1.545f;
  const float cAge = sex == Sex::Male ? 0.103f : 0.097f;
  const float cInt = sex == Sex::Male ? -21.992f : -12.689f;
  const float bf = roundTenth(cBmi * bmi + cAge * age + cInt - 500.f / impedance);
  return (bf >= 1.f && bf <= 80.f) ? bf : 0.f;
}

float parseBroadcast(const uint8_t* p, size_t len) {
  if (len < 19 || p[0] != 0xAA || p[1] != 0xBB) return 0.f;
  if ((p[15] & 0x01) == 0) return 0.f;  // still settling
  const float kg = (float)((uint16_t)p[17] | ((uint16_t)p[18] << 8)) / 100.f;
  return plausibleWeight(kg) ? kg : 0.f;
}

bool isBroadcastAdvertisement(const uint8_t* d, size_t len) {
  return len >= 4 && d[0] == 0xFF && d[1] == 0xFF && d[2] == 0xAA && d[3] == 0xBB;
}

bool isQnAdvertisement(const uint8_t* d, size_t len) {
  return len >= 4 && d[0] == 0xFF && d[1] == 0xFF && !isBroadcastAdvertisement(d, len);
}

Write Session::currentTimeCommand() const {
  // 02 <seconds since the scale epoch, little-endian>, no checksum (qn-scale PROTOCOL.md).
  Write w;
  const uint32_t t = now_ - kScaleEpoch;
  const uint8_t b[] = {0x02, (uint8_t)t, (uint8_t)(t >> 8), (uint8_t)(t >> 16), (uint8_t)(t >> 24)};
  memcpy(w.bytes, b, sizeof b);
  w.len = sizeof b;
  return w;
}

Actions Session::onFrame(const uint8_t* f, size_t len) {
  Actions a;
  if (len < 3) return a;
  sawFrame_ = true;
  const uint8_t op = f[0], flen = f[1];

  // Byte 2 is the scale's vendor byte on these frames; every reply echoes it.
  if (op == kMeasurement || op == kUnitRequest || op == kInitRequest || op == kPreMeasurement || op == kStored) {
    vendor_ = f[2];
  }

  switch (op) {
    case kUnitRequest: {
      if (unitSent_) break;
      unitSent_ = true;
      uint8_t c[] = {0x13, 0x09, vendor_, 0x01 /* kg */, 0x10, 0x00, 0x00, 0x00, 0x00};
      c[8] = checksum(c, 8);
      a.write(c, sizeof c);
      break;
    }
    case kInitRequest: {
      if (initSent_) break;
      initSent_ = true;
      // 20 08 <vendor> <time LE> <sum>: sets the scale's clock and starts the measurement stream.
      const uint32_t t = now_ - kScaleEpoch;
      uint8_t c[] = {0x20, 0x08, vendor_, (uint8_t)t, (uint8_t)(t >> 8), (uint8_t)(t >> 16), (uint8_t)(t >> 24), 0x00};
      c[7] = checksum(c, 7);
      a.write(c, sizeof c);
      break;
    }
    case kPreMeasurement: {
      if (flen >= kLenExtendedPre && vendor_ == kRenphoVendor) {
        // Extended flavor: it will not measure until it gets a profile. Guest mode, so the official app's users
        // on the scale are left alone. Algorithm 0x04 makes the scale work out body fat itself.
        extended_ = true;
        if (profileSent_) break;
        profileSent_ = true;
        const int mm = (int)lroundf(profile_.heightM * 1000.f);
        const uint8_t algo = (profile_.age > 0 && mm > 0) ? 0x04 : 0x00;
        uint8_t c[] = {0xA0, 0x0D, 0x02, 0xFE, 0xFF, 0xEE, (uint8_t)profile_.sex, (uint8_t)profile_.age,
                       (uint8_t)(mm >> 8), (uint8_t)mm, algo, 0x02, 0x00};
        c[12] = checksum(c, 12);
        a.write(c, sizeof c);
      } else if (!storedQueried_) {
        // Basic flavor streams on its own. Ask for readings it stored while nobody was listening; each one is
        // deleted from the scale as it is delivered.
        storedQueried_ = true;
        uint8_t c[] = {0x22, 0x04, vendor_, 0x00};
        c[3] = checksum(c, 3);
        a.write(c, sizeof c);
      }
      break;
    }
    case kProfileAck: {
      if (len >= 5 && f[4] == 0x01 && !storedQueried_) {
        storedQueried_ = true;
        storedExtended_ = true;
        uint8_t c[] = {0x22, 0x06, vendor_, 0x00, 0x01, 0x00};
        c[5] = checksum(c, 5);
        a.write(c, sizeof c);
      }
      break;
    }
    case kMeasurement:
      handleMeasurement(f, len, a);
      break;
    case kStored:
      handleStored(f, len, a);
      break;
    default:
      break;  // 0x15/0x16 metric panels and anything unknown: not needed for weight and body fat
  }
  return a;
}

void Session::handleMeasurement(const uint8_t* f, size_t len, Actions& a) {
  const uint8_t flen = f[1];
  if ((flen == kLenExtended || flen == kLenExtendedLong) && len >= kLenExtended) {
    // 10 0e <vendor> <user> <status> <weight BE /100> <r1 BE> <r2 BE> <body fat BE /10> <sum>
    // status 0 = settling, 1 = stable, 2 = final with impedance and body fat.
    extended_ = true;
    if (f[4] != 2 || finalSeen_) return;
    finalSeen_ = true;
    const float kg = be16(f + 5) / 100.f;
    const uint16_t r1 = be16(f + 7);
    const float scaleBf = be16(f + 11) / 10.f;
    endMeasurement(a);
    if (plausibleWeight(kg)) a.reading(finish(kg, r1, scaleBf, 0, false));
    a.done = true;
  } else if (flen == kLenBasic && len >= kLenBasic) {
    // 10 0b <vendor> <weight BE /100> <status> <r1 BE> <r2 BE> <sum>
    // status 0x00 settling, 0x11 stable and measuring impedance, 0x01 final.
    if (f[5] != 0x01 || finalSeen_) return;
    finalSeen_ = true;
    const float kg = be16(f + 3) / 100.f;
    const uint16_t r1 = be16(f + 6);
    endMeasurement(a);
    if (plausibleWeight(kg)) a.reading(finish(kg, r1, 0.f, 0, false));
    a.done = true;
  }
}

void Session::handleStored(const uint8_t* f, size_t len, Actions& a) {
  if (len < kLenStored || f[3] == 0) return;  // f[3] = records in the batch, 0 = none
  uint32_t scaleTime;
  float kg;
  uint16_t r1;
  float scaleBf = 0.f;
  if (storedExtended_) {
    // 23 13 <v> <count> <index> <user> <time LE> <weight BE> <r1> <r2> <body fat BE /10> <sum>
    scaleTime = le32(f + 6);
    kg = be16(f + 10) / 100.f;
    r1 = be16(f + 12);
    scaleBf = be16(f + 16) / 10.f;
  } else {
    // 23 13 <v> <count> <index> <time LE> <weight BE> <r1> <r2> 00 00 00 <sum>
    scaleTime = le32(f + 5);
    kg = be16(f + 9) / 100.f;
    r1 = be16(f + 11);
  }
  const uint32_t unixTime = scaleTime + kScaleEpoch;
  // A scale whose clock was never set reports times near 2000. Skip those, future ones, and old ones.
  const bool timeOk = unixTime <= now_ + 3600 && now_ - unixTime <= kStoredMaxAgeDays * 86400u;
  if (!timeOk || !plausibleWeight(kg)) {
    a.droppedStored++;
    return;
  }
  a.reading(finish(kg, r1, scaleBf, unixTime, true));
}

void Session::endMeasurement(Actions& a) {
  uint8_t c[] = {0x1F, 0x05, vendor_, 0x10, 0x00};
  c[4] = checksum(c, 4);
  a.write(c, sizeof c);
}

Reading Session::finish(float kg, uint16_t impedance, float scaleBf, uint32_t unixTime, bool stored) const {
  Reading r;
  r.weightKg = kg;
  r.impedance = impedance;
  r.unixTime = unixTime;
  r.stored = stored;
  // Prefer the scale's own body fat (extended flavor); otherwise work it out with the same formula.
  r.bodyFatPct = (scaleBf >= 1.f && scaleBf <= 80.f)
                     ? scaleBf
                     : bodyFat(kg, profile_.heightM, profile_.age, profile_.sex, impedance);
  return r;
}

}  // namespace qn
