// QN-scale protocol (Renpho Elis 1 / ES-CS20M and other "QN-Scale" rebrands), pure logic with no BLE or Arduino
// calls, so it runs in the native unit tests (test/test_qn). main.cpp moves bytes between this and the radio.
//
// Sources (MIT): github.com/ronnnnnnnnnnnnn/renpho-escs20m (Renpho flavors, body fat formula, golden values) and
// github.com/PavelDemyanov/qn-scale (handshake and frame layout). README.md has the full exchange.
#pragma once

#include <stddef.h>
#include <stdint.h>

namespace qn {

// The scale counts seconds from 2000-01-01. renpho-escs20m uses this offset (midnight in UTC+8) on live scales;
// it only affects the dates of stored offline readings, by at most 8 hours.
constexpr uint32_t kScaleEpoch = 946656000u;

enum class Sex : uint8_t { Male = 0, Female = 1 };  // the values the scale's profile frame uses

struct Profile {
  Sex sex = Sex::Male;
  int age = 0;          // whole years
  float heightM = 0.f;  // metres
};

// One finished weigh-in. bodyFatPct is 0 when it could not be worked out.
struct Reading {
  float weightKg = 0.f;
  float bodyFatPct = 0.f;
  uint16_t impedance = 0;  // ohms, 0 when the scale sent none
  uint32_t unixTime = 0;   // 0 = "now" (live); stored readings carry their own time
  bool stored = false;     // came from the scale's offline memory
  bool estimatedTime = false;  // stored on a scale whose clock had been reset (new batteries): time worked out
};

constexpr size_t kMaxWrite = 16;
constexpr size_t kMaxWrites = 2;
constexpr size_t kMaxReadings = 8;
// Stored offline readings older than this are not sent: they would add stale points to the Health charts.
constexpr uint32_t kStoredMaxAgeDays = 30;
// A scale clock below this (2020-01-01 in scale seconds) was reset by a battery change: it counts from power-on.
constexpr uint32_t kScaleClockSetMin = 631152000u;

struct Write {
  uint8_t bytes[kMaxWrite];
  size_t len = 0;
};

// What a frame from the scale asks main.cpp to do: commands to write (with response) and finished readings.
struct Actions {
  Write writes[kMaxWrites];
  size_t writeCount = 0;
  Reading readings[kMaxReadings];
  size_t droppedStored = 0;  // stored records skipped (older than kStoredMaxAgeDays, or not datable)
  size_t readingCount = 0;
  bool done = false;  // the live measurement is final: the session can end after the writes

  void write(const uint8_t* b, size_t n);
  void reading(const Reading& r);
};

// Sum of the bytes mod 256: the last byte of every QN frame.
uint8_t checksum(const uint8_t* b, size_t n);

// Renpho's body fat formula (algorithm 0x04, non-athlete). Reproduces the scale's own result within 0.1 point.
// Returns 0 when an input is out of range.
float bodyFat(float weightKg, float heightM, int age, Sex sex, uint16_t impedance);

// The weight in a broadcast-only ("AABB") Renpho advertisement, or 0 when the payload is not a final reading.
// payload is the manufacturer data without its 2-byte company id.
float parseBroadcast(const uint8_t* payload, size_t len);

// True when manufacturer data (company id included, little-endian, as BLE stacks hand it over) is a QN scale
// that wants a connection: company 0xFFFF and not the AABB broadcast magic.
bool isQnAdvertisement(const uint8_t* data, size_t len);
// True for the broadcast-only variant (company 0xFFFF, payload starts AA BB).
bool isBroadcastAdvertisement(const uint8_t* data, size_t len);

// One connection to the scale. Feed every notification to onFrame(); write what comes back, in order.
class Session {
 public:
  Session(const Profile& profile, uint32_t unixNow) : profile_(profile), now_(unixNow) {}

  Actions onFrame(const uint8_t* frame, size_t len);

  // Commands for the fallback: some QN firmware only starts streaming after a "current time" write (0x02).
  // main.cpp sends this when the scale goes quiet after the unit reply.
  Write currentTimeCommand() const;

  // Call once when the connection ends. Returns the stored readings from a reset clock, dated so that the
  // newest one is now: the scale only wakes when someone steps on it, so its newest record is that weigh-in.
  // When the session also gave a live final reading the newest record is older than now by an unknown amount,
  // so those records are dropped (counted in droppedStored).
  Actions finish();

  bool sawFrame() const { return sawFrame_; }
  size_t storedCount() const { return storedCount_; }
  bool extended() const { return extended_; }
  uint8_t vendor() const { return vendor_; }

 private:
  void handleMeasurement(const uint8_t* f, size_t len, Actions& a);
  void handleStored(const uint8_t* f, size_t len, Actions& a);
  void endMeasurement(Actions& a);
  Reading makeReading(float weightKg, uint16_t impedance, float scaleBodyFat, uint32_t unixTime, bool stored) const;
  bool fresh(uint32_t unixTime) const;

  Profile profile_;
  uint32_t now_;
  uint8_t vendor_ = 0xFF;
  bool sawFrame_ = false;
  bool extended_ = false;
  bool storedExtended_ = false;
  bool unitSent_ = false;
  bool initSent_ = false;
  bool profileSent_ = false;
  bool storedQueried_ = false;
  bool finalSeen_ = false;
  size_t storedCount_ = 0;  // stored records received this session
  // Stored records from a reset clock, waiting for finish(): the reading and its power-on seconds.
  Reading undated_[kMaxReadings];
  uint32_t undatedClock_[kMaxReadings];
  size_t undatedCount_ = 0;
};

}  // namespace qn
