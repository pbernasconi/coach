import Testing

@testable import KoboComponents

@Suite struct ChatQuestionLogicTests {
    @Test func aTapPicksAnOptionAndASecondTapDropsIt() {
        #expect(ChatQuestionLogic.toggling("Run", in: []) == ["Run"])
        #expect(ChatQuestionLogic.toggling("Ride", in: ["Run"]) == ["Run", "Ride"])
        #expect(ChatQuestionLogic.toggling("Run", in: ["Run", "Ride"]) == ["Ride"])
    }

    @Test func anOwnOptionIsTrimmedAndNeverBlankOrRepeated() {
        #expect(ChatQuestionLogic.other("  Swim ", options: ["Run"]) == "Swim")
        #expect(ChatQuestionLogic.other("   ", options: ["Run"]) == nil)
        #expect(ChatQuestionLogic.other("Run", options: ["Run"]) == nil)
    }

    @Test func aTypedAnswerIsTrimmedAndNeverBlank() {
        #expect(ChatQuestionLogic.typed("  in the morning\n") == "in the morning")
        #expect(ChatQuestionLogic.typed(" \n") == nil)
    }

    @Test func theNextQuestionIsTheNextUnansweredOneThenAnEarlierOne() {
        #expect(ChatQuestionLogic.next(after: 0, answered: [true, false, false]) == 1)
        #expect(ChatQuestionLogic.next(after: 1, answered: [false, true, true]) == 0)
        #expect(ChatQuestionLogic.next(after: 2, answered: [true, true, true]) == nil)
    }

    @Test func aSecondTapOnTheSameThumbClearsTheRating() {
        #expect(ChatFeedbackRating.tapping(.up, from: nil) == .up)
        #expect(ChatFeedbackRating.tapping(.up, from: .up) == nil)
        #expect(ChatFeedbackRating.tapping(.down, from: .up) == .down)
    }
}

@Suite struct ChatBreakdownLogicTests {
    @Test func theLongestPartFillsTheTrackAndTheRestScaleToIt() {
        #expect(ChatBreakdownLogic.fractions([120, 60, 30]) == [1, 0.5, 0.25])
        #expect(ChatBreakdownLogic.fractions([0, 0]) == [0, 0])
        #expect(ChatBreakdownLogic.fractions([]) == [])
    }
}
