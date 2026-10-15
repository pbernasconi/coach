import Foundation
import Testing

@testable import KoboPatterns

@Suite struct FlowsLoadableStepStateTests {
    @Test func aSubmitRunsThenSucceeds() {
        var state = LoadableStepState()
        #expect(state.canSubmit)
        let accepted = state.send(.submit)
        #expect(accepted)
        #expect(state.isLoading)
        #expect(!state.canSubmit)
        let acceptedAgain = state.send(.succeed)
        #expect(acceptedAgain)
        #expect(state.isReady)
        #expect(state.failureCount == 0)
    }

    /// A second tap while the first submit runs does nothing, so nothing is written twice.
    @Test func aDoubleTapIsIgnored() {
        var state = LoadableStepState()
        state.send(.submit)
        let accepted = state.send(.submit)
        #expect(!accepted)
        #expect(state.phase == .loading)
        state.send(.succeed)
        let acceptedAgain = state.send(.submit)
        #expect(!acceptedAgain)
        #expect(state.isReady)
    }

    @Test func aFailureShowsItsReasonAndCanBeRetried() {
        var state = LoadableStepState()
        state.send(.submit)
        state.send(.fail(message: "Couldn't read line 4."))
        #expect(state.failureMessage == "Couldn't read line 4.")
        #expect(state.failureCount == 1)
        #expect(state.canSubmit)
        let accepted = state.send(.submit)
        #expect(accepted)
        #expect(state.failureMessage == nil)
        state.send(.fail(message: "Couldn't read line 4."))
        #expect(state.failureCount == 2)
    }

    @Test func editingClearsTheFailureBanner() {
        var state = LoadableStepState(.failed(message: "Too short."))
        let accepted = state.send(.edit)
        #expect(accepted)
        #expect(state.phase == .idle)
        let acceptedAgain = state.send(.edit)
        #expect(!acceptedAgain)
    }

    /// A cancelled submit is normal: it returns to idle and never counts as a failure.
    @Test func aCancellationIsNotAFailure() {
        var state = LoadableStepState()
        state.send(.submit)
        let accepted = state.send(.cancel)
        #expect(accepted)
        #expect(state.phase == .idle)
        #expect(state.failureCount == 0)
        let acceptedAgain = state.send(.cancel)
        #expect(!acceptedAgain)
    }

    @Test func resultsWithNoSubmitRunningAreIgnored() {
        var state = LoadableStepState()
        let accepted = state.send(.succeed)
        #expect(!accepted)
        let acceptedAgain = state.send(.fail(message: "x"))
        #expect(!acceptedAgain)
        #expect(state.phase == .idle)
        #expect(state.failureCount == 0)
    }

    @Test func aReadyStepStartsOverWhenItShowsAgain() {
        var state = LoadableStepState(.ready)
        let accepted = state.send(.reset)
        #expect(accepted)
        #expect(state.phase == .idle)
        var loading = LoadableStepState(.loading)
        let acceptedAgain = loading.send(.reset)
        #expect(!acceptedAgain)
        let acceptedThird = loading.send(.edit)
        #expect(!acceptedThird)
        #expect(loading.isLoading)
    }

    @Test func onlyARisingFailureCountPlaysTheHaptic() {
        #expect(LoadableStepState.playsFailureFeedback(old: 0, new: 1))
        #expect(!LoadableStepState.playsFailureFeedback(old: 1, new: 1))
        #expect(!LoadableStepState.playsFailureFeedback(old: 2, new: 0))
    }
}
