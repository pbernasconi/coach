import Foundation
import KoboComponents
import LiftSync
import Testing

@testable import Lift

/// The streamed reply (lift/APP-API.md, "Coach answer stream"): the events, the progress they make, and the tab.
@MainActor
@Suite struct CoachStreamTests {
    private func make(_ coach: FakeCoach) -> CoachViewModel {
        CoachViewModel(
            coach: coach,
            plan: FakeCoachPlan([]),
            router: RecordingNavigator(),
            tabs: RecordingTabs(),
            mediaLoader: LiftSessionMediaLoader(),
            speech: FakeSpeech(),
            clock: ImmediateClock(),
            settings: RecordingAppSettings(),
            presence: CoachPresence()
        )
    }

    @Test(.timeLimit(.minutes(1))) func progressShowsWhileTheReplyStreamsIn() async {
        let (events, feed) = AsyncThrowingStream.makeStream(of: CoachReplyEvent.self, throwing: (any Error).self)
        let vm = make(FakeCoach(.success(CoachReply(text: "unused")), feed: events))
        vm.send(.draftChanged("I'm sore"))
        let task = vm.send(.sendTapped)
        let thinking = CoachProgress(step: .thinking, thinking: "Sore legs.")
        feed.yield(.progress(thinking))
        while vm.state.phase != .answering(thinking) { await Task.yield() }
        #expect(vm.state.isResponding)
        feed.yield(.reply(CoachReply(text: "Easy day.")))
        feed.finish()
        await task?.value
        #expect(vm.state.phase == .idle)
        #expect(vm.state.messages.count == 2)
    }

    @Test func aStreamThatFailsShowsTheReason() async {
        let (events, feed) = AsyncThrowingStream.makeStream(of: CoachReplyEvent.self, throwing: (any Error).self)
        let vm = make(FakeCoach(.success(CoachReply(text: "unused")), feed: events))
        feed.yield(.progress(CoachProgress()))
        feed.finish(throwing: CoachChatError(message: "Coach could not answer. Try again."))
        vm.send(.draftChanged("hi"))
        await vm.send(.sendTapped)?.value
        #expect(vm.state.phase == .failed("Coach could not answer. Try again."))
    }

    @Test func eventsMoveTheProgressAlong() {
        var progress = CoachProgress()
        let lines: [(String, String)] = [
            ("message", #"{"type":"message","message":{"id":"m","role":"user","text":"hi"}}"#),
            ("status", #"{"type":"status","step":"thinking"}"#),
            ("thinking", #"{"type":"thinking","text":"Sore legs. "}"#),
            ("thinking", #"{"type":"thinking","text":"Lift today"}"#),
            ("text", #"{"type":"text","delta":"Easy "}"#),
            ("text", #"{"type":"text","delta":"day."}"#),
            ("status", #"{"type":"status","step":"proposing"}"#),
        ]
        let outcomes = lines.map { CoachStreamWire.apply(ServerSentEvent(event: $0.0, data: $0.1), to: &progress) }
        #expect(outcomes.first == CoachStreamWire.Outcome.ignored)
        #expect(progress == CoachProgress(step: .proposing, thinking: "Sore legs. Lift today", text: "Easy day."))
        #expect(progress.latestThought == "Lift today")
    }

    @Test func doneCarriesTheReplyAndErrorItsWords() {
        var progress = CoachProgress()
        let done =
            #"{"threadId":"t","message":{"id":"m","role":"user","text":"hi"},"#
            + #""reply":{"id":"r","role":"assistant","text":"Easy day.","quickReplies":["Yes"]}}"#
        let reply = CoachStreamWire.apply(ServerSentEvent(event: "done", data: done), to: &progress)
        #expect(reply == .reply(CoachReply(text: "Easy day.", quickReplies: ["Yes"])))
        let error = CoachStreamWire.apply(ServerSentEvent(event: "error", data: #"{"error":"No."}"#), to: &progress)
        #expect(error == .failed("No."))
    }

    @Test func anUnknownStepIsIgnored() {
        var progress = CoachProgress()
        let outcome = CoachStreamWire.apply(
            ServerSentEvent(event: "status", data: #"{"step":"dreaming"}"#),
            to: &progress
        )
        #expect(outcome == .ignored)
        #expect(progress.step == .reading)
    }
}
