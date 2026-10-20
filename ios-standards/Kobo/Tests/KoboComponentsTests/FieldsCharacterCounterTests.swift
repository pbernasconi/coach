import Testing

@testable import KoboComponents

/// The counter rule under a limited field.
@Suite struct FieldsCharacterCounterTests {
    @Test func shortLimitAlwaysShowsTheFraction() {
        #expect(CharacterCounter.caption(count: 0, limit: 40) == .fraction(count: 0, limit: 40))
        #expect(CharacterCounter.caption(count: 12, limit: 140) == .fraction(count: 12, limit: 140))
    }

    @Test func longLimitHidesUntilNearTheLimit() {
        #expect(CharacterCounter.caption(count: 399, limit: 500) == nil)
        #expect(CharacterCounter.caption(count: 400, limit: 500) == .remaining(100))
        #expect(CharacterCounter.caption(count: 499, limit: 500) == .remaining(1))
        #expect(CharacterCounter.caption(count: 500, limit: 500) == .remaining(0))
        #expect(CharacterCounter.caption(count: 3, limit: 0) == nil)
    }

    @Test func atLimitOnlyWhenFull() {
        #expect(!CharacterCounter.isAtLimit(count: 499, limit: 500))
        #expect(CharacterCounter.isAtLimit(count: 500, limit: 500))
        #expect(!CharacterCounter.isAtLimit(count: 0, limit: 0))
    }

    @Test func warnsFromNinetyPercent() {
        #expect(!CharacterCounter.isNearLimit(count: 35, limit: 40))
        #expect(CharacterCounter.isNearLimit(count: 36, limit: 40))
    }

    @Test func countsWhatPeopleSeeAsCharacters() {
        #expect(CharacterCounter.count("café") == 4)
        #expect(CharacterCounter.count("e\u{301}") == 1)
        #expect(CharacterCounter.count("👍🏽🇯🇵") == 2)
    }

    @Test func clampNeverSplitsACharacter() {
        #expect(CharacterCounter.clamped("ab👍🏽cd", to: 3) == "ab👍🏽")
        #expect(CharacterCounter.clamped("short", to: 40) == "short")
        #expect(CharacterCounter.clamped("anything", to: 0) == "anything")
    }
}
