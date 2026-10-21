// Native tests for the QN protocol: `pio test -e native`. Frames are real captures from renpho-escs20m's tests
// (Renpho ES-CS20M and an Arboleaf CS20M, the same protocol).
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unity.h>

#include "qn.h"

using namespace qn;

namespace {

// 2026-10-21 12:00 UTC.
constexpr uint32_t kNow = 1792584000u;

size_t hex(const char* s, uint8_t* out) {
  size_t n = 0;
  for (; s[0] && s[1]; s += 2) {
    char b[3] = {s[0], s[1], 0};
    out[n++] = (uint8_t)strtoul(b, nullptr, 16);
  }
  return n;
}

Actions feed(Session& s, const char* h) {
  uint8_t b[32];
  const size_t n = hex(h, b);
  return s.onFrame(b, n);
}

void assertWrite(const Actions& a, size_t i, const char* expected) {
  uint8_t b[32];
  const size_t n = hex(expected, b);
  TEST_ASSERT_TRUE_MESSAGE(i < a.writeCount, "missing write");
  TEST_ASSERT_EQUAL_UINT(n, a.writes[i].len);
  TEST_ASSERT_EQUAL_HEX8_ARRAY(b, a.writes[i].bytes, n);
}

Profile paolo() {
  Profile p;
  p.sex = Sex::Male;
  p.age = 43;
  p.heightM = 1.70f;
  return p;
}

}  // namespace

void setUp() {}
void tearDown() {}

void test_checksum() {
  const uint8_t b[] = {0x1F, 0x05, 0x15, 0x10};
  TEST_ASSERT_EQUAL_HEX8(0x49, checksum(b, 4));
}

// Golden values: the scale's own body fat for these inputs (renpho-escs20m test_calculate_body_fat.py).
void test_body_fat_matches_scale() {
  TEST_ASSERT_FLOAT_WITHIN(0.11f, 21.0f, bodyFat(74.95f, 1.70f, 43, Sex::Male, 505));
  TEST_ASSERT_FLOAT_WITHIN(0.11f, 21.6f, bodyFat(76.15f, 1.70f, 43, Sex::Male, 502));
  TEST_ASSERT_FLOAT_WITHIN(0.11f, 23.1f, bodyFat(78.95f, 1.70f, 43, Sex::Male, 501));
  TEST_ASSERT_FLOAT_WITHIN(0.11f, 24.3f, bodyFat(81.30f, 1.70f, 43, Sex::Male, 505));
  TEST_ASSERT_FLOAT_WITHIN(0.11f, 42.5f, bodyFat(81.65f, 1.55f, 38, Sex::Female, 510));
  TEST_ASSERT_FLOAT_WITHIN(0.11f, 23.0f, bodyFat(75.25f, 1.85f, 28, Sex::Female, 509));
}

void test_body_fat_needs_inputs() {
  TEST_ASSERT_EQUAL_FLOAT(0.f, bodyFat(80.f, 1.80f, 40, Sex::Male, 0));
  TEST_ASSERT_EQUAL_FLOAT(0.f, bodyFat(80.f, 0.f, 40, Sex::Male, 500));
  TEST_ASSERT_EQUAL_FLOAT(0.f, bodyFat(80.f, 1.80f, 0, Sex::Male, 500));
}

// Full Arboleaf session (basic flavor, vendor byte 0x15): unit reply, clock, stored query, end command.
void test_basic_session_replay() {
  Session s(paolo(), kNow);
  Actions a = feed(s, "120f1505aa0bcb0bd83f013f010523");
  assertWrite(a, 0, "130915011000000042");  // kg; the capture's lb reply was 1309150210...43

  a = feed(s, "140b150000010000000035");
  TEST_ASSERT_EQUAL_UINT(1, a.writeCount);
  TEST_ASSERT_EQUAL_HEX8(0x20, a.writes[0].bytes[0]);
  TEST_ASSERT_EQUAL_HEX8(0x15, a.writes[0].bytes[2]);
  TEST_ASSERT_EQUAL_HEX8(checksum(a.writes[0].bytes, 7), a.writes[0].bytes[7]);
  const uint32_t t = kNow - kScaleEpoch;
  TEST_ASSERT_EQUAL_HEX8((uint8_t)t, a.writes[0].bytes[3]);
  TEST_ASSERT_EQUAL_HEX8((uint8_t)(t >> 24), a.writes[0].bytes[6]);

  a = feed(s, "210515013c");  // length 5 but not Renpho's vendor byte: basic
  assertWrite(a, 0, "2204153b");
  TEST_ASSERT_FALSE(s.extended());

  // The capture's stored records carry a clock near 2000 (never set), so they are skipped.
  a = feed(s, "2314150501da0100001c9301f901f300000000ca");
  TEST_ASSERT_EQUAL_UINT(0, a.readingCount);
  TEST_ASSERT_EQUAL_UINT(1, a.droppedStored);

  a = feed(s, "100b151c5c0000000000a8");
  TEST_ASSERT_EQUAL_UINT(0, a.readingCount);
  TEST_ASSERT_FALSE(a.done);

  a = feed(s, "100b151c660101fa01ee9d");  // final: 72.70 kg, r1 = 506
  assertWrite(a, 0, "1f05151049");
  TEST_ASSERT_TRUE(a.done);
  TEST_ASSERT_EQUAL_UINT(1, a.readingCount);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 72.70f, a.readings[0].weightKg);
  TEST_ASSERT_EQUAL_UINT16(506, a.readings[0].impedance);
  TEST_ASSERT_FLOAT_WITHIN(0.11f, bodyFat(72.70f, 1.70f, 43, Sex::Male, 506), a.readings[0].bodyFatPct);
  TEST_ASSERT_FALSE(a.readings[0].stored);

  a = feed(s, "100b151c660101fa01ee9d");  // the scale repeats the final frame: one reading only
  TEST_ASSERT_EQUAL_UINT(0, a.readingCount);
}

// Renpho extended flavor: profile request, then a final frame with the scale's own body fat.
void test_extended_session() {
  Session s(paolo(), kNow);
  Actions a = feed(s, "1211ff03aa670003ff030305000005074f");
  assertWrite(a, 0, "1309ff01100000002c");
  a = feed(s, "2105ff0126");  // profile request
  TEST_ASSERT_TRUE(s.extended());
  // A0 0D 02 FE FF EE <male=0> <43> <1700 mm BE> <algo 4> 02 <sum>
  assertWrite(a, 0, "a00d02feffee002b06a4040275");

  a = feed(s, "100efffe001d4700000000000020");  // settling
  TEST_ASSERT_EQUAL_UINT(0, a.readingCount);
  a = feed(s, "100efffe021d4701f901f700d245");  // final: 74.95 kg, r1 505, body fat 21.0
  assertWrite(a, 0, "1f05ff1033");
  TEST_ASSERT_TRUE(a.done);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 74.95f, a.readings[0].weightKg);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 21.0f, a.readings[0].bodyFatPct);
  TEST_ASSERT_EQUAL_UINT16(505, a.readings[0].impedance);
}

// The 15-byte R-MSB01 final frame has the same layout.
void test_extended_long_frame() {
  Session s(paolo(), kNow);
  Actions a = feed(s, "100ffffe02299a10ef10ed01480026");
  TEST_ASSERT_TRUE(a.done);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 106.50f, a.readings[0].weightKg);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 32.8f, a.readings[0].bodyFatPct);
}

void test_stored_reading_within_window() {
  Session s(paolo(), kNow);
  feed(s, "2104153a");  // basic pre-measurement
  // Build a stored record from yesterday: 81.10 kg, r1 500.
  const uint32_t t = kNow - 86400 - kScaleEpoch;
  uint8_t f[19] = {0x23, 0x13, 0x15, 0x01, 0x01, (uint8_t)t, (uint8_t)(t >> 8), (uint8_t)(t >> 16), (uint8_t)(t >> 24),
                   0x1F, 0xAE, 0x01, 0xF4, 0x01, 0xF4, 0, 0, 0, 0};
  f[18] = checksum(f, 18);
  Actions a = s.onFrame(f, sizeof f);
  TEST_ASSERT_EQUAL_UINT(1, a.readingCount);
  TEST_ASSERT_TRUE(a.readings[0].stored);
  TEST_ASSERT_EQUAL_UINT32(kNow - 86400, a.readings[0].unixTime);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 81.10f, a.readings[0].weightKg);
  TEST_ASSERT_FALSE(a.done);
}

void test_stored_reading_too_old() {
  Session s(paolo(), kNow);
  const uint32_t t = kNow - 40u * 86400u - kScaleEpoch;
  uint8_t f[19] = {0x23, 0x13, 0x15, 0x01, 0x01, (uint8_t)t, (uint8_t)(t >> 8), (uint8_t)(t >> 16), (uint8_t)(t >> 24),
                   0x1F, 0xAE, 0x01, 0xF4, 0x01, 0xF4, 0, 0, 0, 0};
  Actions a = s.onFrame(f, sizeof f);
  TEST_ASSERT_EQUAL_UINT(0, a.readingCount);
  TEST_ASSERT_EQUAL_UINT(1, a.droppedStored);
}

void test_current_time_command() {
  Session s(paolo(), kNow);
  const Write w = s.currentTimeCommand();
  const uint32_t t = kNow - kScaleEpoch;
  TEST_ASSERT_EQUAL_UINT(5, w.len);
  TEST_ASSERT_EQUAL_HEX8(0x02, w.bytes[0]);
  TEST_ASSERT_EQUAL_HEX8((uint8_t)t, w.bytes[1]);
  TEST_ASSERT_EQUAL_HEX8((uint8_t)(t >> 24), w.bytes[4]);
}

void test_advertisements() {
  // Manufacturer data as the BLE stack hands it over: company id FFFF (LE) first.
  uint8_t qnAdv[16];
  size_t n = hex("ffff095b0101aabbcc112233", qnAdv);
  TEST_ASSERT_TRUE(isQnAdvertisement(qnAdv, n));
  TEST_ASSERT_FALSE(isBroadcastAdvertisement(qnAdv, n));

  uint8_t other[8];
  n = hex("4c000215", other);  // Apple
  TEST_ASSERT_FALSE(isQnAdvertisement(other, n));

  // AABB broadcast: magic, MAC, ..., status byte 15 (final), weight LE at 17-18 (83.45 kg = 0x2099).
  uint8_t bc[19] = {0xAA, 0xBB, 1, 2, 3, 4, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0x03, 0, 0x99, 0x20};
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 83.45f, parseBroadcast(bc, sizeof bc));
  bc[15] = 0x02;  // settling
  TEST_ASSERT_EQUAL_FLOAT(0.f, parseBroadcast(bc, sizeof bc));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_checksum);
  RUN_TEST(test_body_fat_matches_scale);
  RUN_TEST(test_body_fat_needs_inputs);
  RUN_TEST(test_basic_session_replay);
  RUN_TEST(test_extended_session);
  RUN_TEST(test_extended_long_frame);
  RUN_TEST(test_stored_reading_within_window);
  RUN_TEST(test_stored_reading_too_old);
  RUN_TEST(test_current_time_command);
  RUN_TEST(test_advertisements);
  return UNITY_END();
}
