import Foundation
import KoboTokens
import Testing

@testable import KoboComponents

@Suite struct DisplayLogicTests {
    // MARK: Progress ring

    @Test(arguments: [(-0.5, 0.0), (0.0, 0.0), (0.4, 0.4), (1.0, 1.0), (1.7, 1.0), (Double.infinity, 1.0)])
    func ringClampsProgress(input: Double, expected: Double) {
        #expect(RingMath.clamp(input) == expected)
    }

    @Test func ringTreatsNaNAsEmpty() {
        #expect(RingMath.clamp(.nan) == 0)
    }

    // MARK: Countdown ring

    private static let start = Date(timeIntervalSinceReferenceDate: 1_000)
    private static let end = start.addingTimeInterval(100)

    @Test(arguments: [(-10.0, 1.0), (0.0, 1.0), (25.0, 0.75), (50.0, 0.5), (100.0, 0.0), (130.0, 0.0)])
    func countdownFraction(elapsed: Double, expected: Double) {
        let now = Self.start.addingTimeInterval(elapsed)
        let fraction = CountdownMath.fraction(now: now, start: Self.start, end: Self.end)
        #expect(abs(fraction - expected) < 1e-9)
    }

    @Test func countdownWithNoLengthIsEmpty() {
        #expect(CountdownMath.fraction(now: Self.start, start: Self.start, end: Self.start) == 0)
        #expect(CountdownMath.fraction(now: Self.start, start: Self.end, end: Self.start) == 0)
    }

    @Test func countdownIntervalIsAlwaysOrdered() {
        #expect(CountdownMath.interval(start: Self.end, end: Self.start) == Self.start...Self.end)
        #expect(CountdownMath.interval(start: Self.start, end: Self.end) == Self.start...Self.end)
    }

    @Test(arguments: [(180, "3:00"), (5, "0:05"), (0, "0:00"), (600, "10:00"), (3_723, "1:02:03"), (-4, "0:00")])
    func countdownClockText(seconds: Int, expected: String) {
        #expect(CountdownMath.clockText(seconds: seconds) == expected)
    }

    @Test func countdownTotalIsWholeSeconds() {
        #expect(CountdownMath.totalSeconds(start: Self.start, end: Self.start.addingTimeInterval(179.6)) == 180)
        #expect(CountdownMath.totalSeconds(start: Self.end, end: Self.start) == 0)
    }

    // MARK: Monogram

    @Test(arguments: [
        ("Ada Lovelace", "AL"),
        ("ada", "A"),
        ("Grace Brewster Murray Hopper", "GH"),
        ("Jean-Luc Picard", "JP"),
        ("  ", ""),
        ("", ""),
        ("& Co", "C"),
        ("élodie durand", "ÉD"),
        ("3M Company", "3C"),
    ])
    func monogramInitials(name: String, expected: String) {
        #expect(Monogram.initials(from: name) == expected)
    }

    @Test func monogramToneIsStableAndNeverDanger() {
        #expect(Monogram.tone(for: "Ada Lovelace") == Monogram.tone(for: "  ada lovelace "))
        for name in ["Ada", "Grace", "Alan", "Katherine", "Margaret", ""] {
            #expect(Monogram.tone(for: name) != .danger)
        }
    }

    #if canImport(SwiftUI)  // the type lives in a SwiftUI file
        @Test func avatarDiametersGrow() {
            let sizes = Avatar.Diameter.allCases.map(\.points)
            #expect(sizes == sizes.sorted())
            #expect(Avatar.Diameter.medium.points >= Size.minTouch)
        }
    #endif
}
