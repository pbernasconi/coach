import Foundation
import KoboComponents
import Testing

@testable import Lift

/// The microphone, the tab coming and going, and a conversation that Coach is still answering.
@MainActor
@Suite struct CoachVoiceTests {
    let speech = FakeSpeech()
    let settings = RecordingAppSettings()
    let presence = CoachPresence()

    private func make(_ coach: FakeCoach, clock: any Clock<Duration> = HeldClock()) -> CoachViewModel {
        CoachViewModel(
            coach: coach, plan: FakeCoachPlan([]), router: RecordingNavigator(), tabs: RecordingTabs(),
            mediaLoader: LiftSessionMediaLoader(), speech: speech, clock: clock, settings: settings, presence: presence
        )
    }

    private let reply = CoachReply(text: "Done.")

    @Test func micTappedPutsTheWordsAfterTheDraftAndASecondTapKeepsThem() async {
        let vm = make(FakeCoach(.success(reply)))
        vm.send(.draftChanged("Hi"))
        vm.send(.micTapped)
        await settle { speech.starts == 1 }
        speech.hear("move the lift")
        await settle { vm.state.draft == "Hi move the lift" }
        #expect(vm.state.draft == "Hi move the lift")
        #expect(vm.state.voice.phase == .listening)
        vm.send(.micTapped)
        #expect(vm.state.voice.phase == .idle)
        #expect(speech.stops >= 1)
        #expect(vm.state.draft == "Hi move the lift")
        #expect(vm.state.messages.isEmpty)
    }

    @Test func micHoldEndedSendsWhatWasHeard() async {
        let vm = make(FakeCoach(.success(reply)))
        vm.send(.micHoldBegan)
        await settle { speech.starts == 1 }
        speech.hear("easy run today")
        await settle { vm.state.draft == "easy run today" }
        await vm.send(.micHoldEnded)?.value
        #expect(vm.state.messages.first?.body == .mine("easy run today"))
        #expect(vm.state.draft.isEmpty)
    }

    @Test func micHoldBeganThenReleasedWithNothingHeardSendsNothing() async {
        let vm = make(FakeCoach(.success(reply)))
        vm.send(.draftChanged("half a thought"))
        vm.send(.micHoldBegan)
        await settle { speech.starts == 1 }
        #expect(vm.send(.micHoldEnded) == nil)
        #expect(vm.state.messages.isEmpty)
        #expect(vm.state.draft == "half a thought")
    }

    @Test func aDeniedMicrophoneShowsTheWayAndVoiceSettingsTappedOpensSettings() async {
        speech.denies = true
        let vm = make(FakeCoach(.success(reply)))
        await vm.send(.micTapped)?.value
        #expect(vm.state.voice.phase == .unavailable)
        vm.send(.voiceSettingsTapped)
        #expect(settings.opened == 1)
    }

    @Test func shownMarksTheConversationOnScreenAndLeavingStopsListening() async {
        let vm = make(FakeCoach(.success(reply)))
        vm.send(.shown(true))
        #expect(presence.isShown)
        vm.send(.micTapped)
        await settle { speech.starts == 1 }
        vm.send(.shown(false))
        #expect(!presence.isShown)
        #expect(vm.state.voice.phase == .idle)
        #expect(speech.stops >= 1)
    }

    @Test func sceneActiveReadsTheConversationAgainAndTheBackgroundStopsListening() async {
        let coach = FakeCoach(.success(reply))
        await coach.setThread(CoachThread(messages: [CoachMessage(id: "m1", body: .mine("Hi"))]))
        let vm = make(coach)
        vm.send(.micTapped)
        await settle { speech.starts == 1 }
        vm.send(.sceneActive(false))
        #expect(vm.state.voice.phase == .idle)
        await vm.send(.sceneActive(true))?.value
        #expect(vm.state.messages.map(\.id) == ["m1"])
    }

    @Test func aConversationStillBeingAnsweredPollsUntilTheReplyComes() async {
        let mine = CoachMessage(id: "m1", body: .mine("Move it"))
        let answer = CoachMessage(id: "m2", body: .coach(reply))
        let coach = FakeCoach(.success(reply))
        await coach.queue([CoachThread(messages: [mine], answering: true), CoachThread(messages: [mine], answering: true)])
        await coach.setThread(CoachThread(messages: [mine, answer]))
        let vm = make(coach, clock: ImmediateClock())
        await vm.run()
        #expect(vm.state.phase == .waiting)
        await settle { vm.state.phase == .idle }
        #expect(vm.state.messages.map(\.id) == ["m1", "m2"])
        #expect(await coach.threadReads == 3)
    }

    @Test func aReplyLostWithTheConnectionShowsOnceTheServerHasIt() async {
        let coach = FakeCoach(.failure(CoachChatError(message: "Offline")))
        let mine = CoachMessage(id: "m1", body: .mine("Move it"))
        await coach.setThread(CoachThread(messages: [mine, CoachMessage(id: "m2", body: .coach(reply))]))
        let vm = make(coach)
        vm.send(.draftChanged("Move it"))
        await vm.send(.sendTapped)?.value
        #expect(vm.state.phase == .idle)
        #expect(vm.state.messages.map(\.id) == ["m1", "m2"])
    }

    @Test(arguments: [
        ("coach.replied", true, false), ("coach.replied", false, true), ("plan.ready", true, true), (nil, true, true),
    ] as [(String?, Bool, Bool)])
    func aCoachReplyShowsNoBannerOverTheConversation(type: String?, coachShown: Bool, banner: Bool) {
        #expect(CoachPresence.showsBanner(type: type, coachShown: coachShown) == banner)
    }
}
