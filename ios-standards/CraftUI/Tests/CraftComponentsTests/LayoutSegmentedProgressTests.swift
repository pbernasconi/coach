import Testing

@testable import CraftComponents

@Suite struct LayoutSegmentedProgressTests {
    @Test func doneThenPlannedThenRequiredThenOptional() {
        #expect(
            ProgressSegment.segments(done: 1, planned: 1, minimum: 3, goal: 5)
                == [.done, .planned, .required, .optional, .optional]
        )
    }

    @Test func plannedCountsTowardRequired() {
        #expect(
            ProgressSegment.segments(done: 2, planned: 1, minimum: 3, goal: 4)
                == [.done, .done, .planned, .optional]
        )
    }

    @Test func minimumIsAPositionNotACount() {
        #expect(ProgressSegment.segments(done: 1, minimum: 2, goal: 3) == [.done, .required, .optional])
    }

    @Test func passingTheGoalAddsDoneSegments() {
        #expect(ProgressSegment.segments(done: 5, goal: 3) == Array(repeating: .done, count: 5))
    }

    @Test func emptyAndNegativeInputs() {
        #expect(ProgressSegment.segments(done: 0, goal: 0).isEmpty)
        #expect(ProgressSegment.segments(done: -2, planned: -1, goal: 2) == [.optional, .optional])
    }

    @Test func accessibilityValueIsDoneOfTotal() {
        let segments = ProgressSegment.segments(done: 2, planned: 1, minimum: 3, goal: 4)
        #expect(ProgressSegment.accessibilityValue(for: segments) == "2 of 4")
    }
}
