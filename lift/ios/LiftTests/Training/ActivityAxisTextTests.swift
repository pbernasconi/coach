import Testing

@testable import Lift

@Suite struct ActivityAxisTextTests {
    @Test(arguments: [(0.0, "0:00"), (65.4, "1:05"), (3723, "1:02:03"), (-5, "0:00"), (.nan, "0:00")])
    func clock(seconds: Double, expected: String) {
        #expect(ActivityAxisText.clock(seconds) == expected)
    }

    @Test func streamValues() {
        #expect(ActivityAxisText.stream(336, unit: "/km") == "5:36 /km")
        #expect(ActivityAxisText.stream(145.4, unit: "bpm") == "145 bpm")
    }

    @Test func speedsAsPaceOrKmPerHour() {
        #expect(ActivityAxisText.speed(1000.0 / 336, unit: "/km") == "5:36 /km")
        #expect(ActivityAxisText.speed(10, unit: "km/h") == "36.0 km/h")
        #expect(ActivityAxisText.speed(0, unit: "/km") == "–")
    }

    @Test func durations() {
        #expect(ActivityAxisText.duration(5) == "5s")
        #expect(ActivityAxisText.duration(1200) == "20m")
        #expect(ActivityAxisText.duration(3600) == "1h")
    }
}
