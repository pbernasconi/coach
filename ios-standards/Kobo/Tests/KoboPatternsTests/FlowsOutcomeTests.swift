import Foundation
import KoboTokens
import Testing

@testable import KoboPatterns

@Suite struct FlowsOutcomeTests {
    /// The first frame is loading, never "we couldn't confirm": only giving up leads to `unknown`.
    @Test func thePhaseFollowsTheFlow() {
        #expect(OutcomePhase.waiting(isAccepted: false, gaveUp: false) == .loading)
        #expect(OutcomePhase.waiting(isAccepted: true, gaveUp: false) == .pending)
        #expect(OutcomePhase.waiting(isAccepted: true, gaveUp: true) == .unknown)
        #expect(OutcomePhase.waiting(isAccepted: false, gaveUp: true) == .unknown)
    }

    @Test func eachPhaseHasAToneAndAGlyph() {
        #expect(OutcomePhase.success.tone == .success)
        #expect(OutcomePhase.failure.tone == .danger)
        #expect(OutcomePhase.unknown.tone == .warning)
        #expect(OutcomePhase.pending.tone == .neutral)
        #expect(Set(OutcomePhase.allCases.map(\.symbol)).count == 4)
        #expect(OutcomePhase.allCases.filter(\.isSettled) == [.success, .failure, .unknown])
    }

    @Test func aSettledOutcomePlaysOneHaptic() {
        #expect(OutcomeLandingFeedback.of(.success, hasPlayed: false) == .success)
        #expect(OutcomeLandingFeedback.of(.failure, hasPlayed: false) == .error)
        #expect(OutcomeLandingFeedback.of(.unknown, hasPlayed: false) == .warning)
        #expect(OutcomeLandingFeedback.of(.pending, hasPlayed: false) == nil)
        #expect(OutcomeLandingFeedback.of(.loading, hasPlayed: false) == nil)
        for phase in OutcomePhase.allCases {
            #expect(OutcomeLandingFeedback.of(phase, hasPlayed: true) == nil)
        }
    }

    @Test func shareTextListsTheFactsLineByLine() {
        let facts = [
            OutcomeFact(verbatim: "Duration", value: "1 h 12 min"),
            OutcomeFact(verbatim: "Tasks", value: "18"),
        ]
        let lines = OutcomeShareText.lines(
            title: "Project finished",
            status: "Launch prep",
            facts: facts,
            footer: "example.app"
        )
        #expect(lines == ["Project finished", "Launch prep", "Duration: 1 h 12 min", "Tasks: 18", "example.app"])
        #expect(
            OutcomeShareText.text(title: "Project finished", facts: facts)
                == "Project finished\nDuration: 1 h 12 min\nTasks: 18"
        )
    }

    @Test func shareTextSkipsMissingParts() {
        let facts = [OutcomeFact(verbatim: "Notes", value: "")]
        #expect(OutcomeShareText.lines(title: "Imported", status: "", facts: facts, footer: nil) == ["Imported"])
    }

    @Test func factsKeyOnTheirIdOrTheirLabel() {
        #expect(OutcomeFact(verbatim: "Tasks", value: "18").id == "Tasks")
        #expect(OutcomeFact(verbatim: "Tasks", value: "18", id: "tasks-1").id == "tasks-1")
    }

    /// Reduce Motion never scales and never draws: everything is whole at once.
    @Test func theEntranceRespectsReduceMotion() {
        #expect(OutcomeEntrance.scale(from: 0.9, isShown: false, reduceMotion: false) == 0.9)
        #expect(OutcomeEntrance.scale(from: 0.9, isShown: false, reduceMotion: true) == 1)
        #expect(OutcomeEntrance.scale(from: 0.9, isShown: true, reduceMotion: false) == 1)
        #expect(OutcomeEntrance.drawn(isDrawn: false, reduceMotion: false) == 0)
        #expect(OutcomeEntrance.drawn(isDrawn: false, reduceMotion: true) == 1)
        #expect(OutcomeEntrance.opacity(isShown: false) == 0)
        #expect(OutcomeEntrance.showsContent(isRevealed: false, voiceOver: true))
        #expect(!OutcomeEntrance.showsContent(isRevealed: false, voiceOver: false))
        #expect(OutcomeEntrance.discDelay < OutcomeEntrance.drawDelay)
        #expect(OutcomeEntrance.drawDelay < OutcomeEntrance.contentDelay)
    }

    @Test func theHeroScalesFromOneDiameter() {
        #expect(abs(OutcomeHeroMetrics.disc(halo: 100) - 64) < 1e-9)
        #expect(abs(OutcomeHeroMetrics.glyph(halo: 100) - 32) < 1e-9)
        #expect(abs(OutcomeHeroMetrics.checkLineWidth(checkSide: 24) - 2.8) < 1e-9)
        #expect(OutcomeHeroMetrics.checkPoints.count == 3)
    }

    @Test func aPrimerShowsAtMostThreeReasons() {
        let reasons = (1...5).map { PrimerPageModel.Reason(symbol: "star", verbatim: "Reason \($0)") }
        let model = PrimerPageModel(
            verbatim: "Turn on alerts",
            message: "So a timer never runs over.",
            reasons: reasons
        )
        #expect(model.reasons.count == PrimerPageModel.maxReasons)
        #expect(model.reasons.map(\.text) == ["Reason 1", "Reason 2", "Reason 3"])
        #expect(model.symbol == nil)
    }
}
