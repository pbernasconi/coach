import Foundation
import KoboComponents
import Testing

@testable import Lift

private let proposalReply = CoachReply(
    text: "Moved it.",
    steps: [CoachChatStep(id: "s", text: "Read this week's plan")],
    proposal: CoachProposal(
        id: "p1",
        title: "1 change",
        items: [ChatActionItem(id: "a", change: .move, title: "Lift", detail: "Tue", previous: "Mon")]
    )
)

/// One test per Action, plus `run()` (TEST-2).
@MainActor
@Suite struct CoachViewModelTests {
    let plan = FakeCoachPlan([])
    let router = RecordingNavigator()
    let tabs = RecordingTabs()
    let media = LiftSessionMediaLoader()

    private func make(_ coach: FakeCoach) -> CoachViewModel {
        CoachViewModel(
            coach: coach, plan: plan, router: router, tabs: tabs, mediaLoader: media,
            speech: FakeSpeech(), clock: ImmediateClock(), settings: RecordingAppSettings(), presence: CoachPresence()
        )
    }

    private func sent(_ coach: FakeCoach, _ text: String = "Move the lift") async -> CoachViewModel {
        let vm = make(coach)
        vm.send(.draftChanged(text))
        await vm.send(.sendTapped)?.value
        return vm
    }

    @Test func runShowsTheServersConversationPromptsAndNotice() async {
        let coach = FakeCoach(.success(proposalReply))
        await coach.setThread(
            CoachThread(
                messages: [CoachMessage(id: "m1", body: .mine("Hi"))],
                prompts: [ChatPrompt(id: "Tomorrow?", title: "Tomorrow?")],
                notice: "This month's budget is used."
            )
        )
        let vm = make(coach)
        await vm.run()
        #expect(vm.state.messages.map(\.id) == ["m1"])
        #expect(vm.state.prompts.map(\.title) == ["Tomorrow?"])
        #expect(vm.state.notice == "This month's budget is used.")
    }

    @Test func runKeepsTheStarterPromptsWhenTheServerSendsNone() async {
        let vm = make(FakeCoach(.success(proposalReply)))
        await vm.run()
        #expect(vm.state.prompts.count == 5)
    }

    @Test func draftChangedKeepsTheDraft() {
        let vm = make(FakeCoach(.success(proposalReply)))
        vm.send(.draftChanged("hi"))
        #expect(vm.state.draft == "hi")
    }

    @Test func promptPickedFillsTheComposerWithoutSending() {
        let vm = make(FakeCoach(.success(proposalReply)))
        vm.send(.promptPicked(vm.state.prompts[0]))
        #expect(vm.state.draft == vm.state.prompts[0].title)
        #expect(vm.state.messages.isEmpty)
    }

    @Test func sendTappedPostsTheMessageAndTheReply() async {
        let vm = await sent(FakeCoach(.success(proposalReply)), "  Move the lift \n")
        #expect(vm.state.messages.map(\.id) == ["local-0", "local-1"])
        #expect(vm.state.messages[0].body == .mine("Move the lift"))
        #expect(vm.state.messages[1].proposal?.status == .pending)
        #expect(vm.state.draft.isEmpty)
        #expect(vm.state.phase == .idle)
    }

    @Test func sendTappedIgnoresABlankDraft() {
        let vm = make(FakeCoach(.success(proposalReply)))
        vm.send(.draftChanged("   "))
        #expect(vm.send(.sendTapped) == nil)
        #expect(vm.state.messages.isEmpty)
    }

    @Test func aFailedReplyShowsTheReasonAndRetryTappedAsksAgain() async {
        let coach = FakeCoach(.failure(CoachChatError(message: "Offline")))
        let vm = await sent(coach)
        #expect(vm.state.phase == .failed("Offline"))
        await coach.setReply(.success(proposalReply))
        await vm.send(.retryTapped)?.value
        #expect(vm.state.phase == .idle)
        #expect(vm.state.messages.count == 2)
    }

    @Test func stopTappedEndsTheWait() {
        let vm = make(FakeCoach(.success(proposalReply)))
        vm.send(.draftChanged("hi"))
        vm.send(.sendTapped)
        #expect(vm.state.isResponding)
        vm.send(.stopTapped)
        #expect(vm.state.phase == .idle)
    }

    @Test func applyTappedAppliesTheProposalAndRefreshesWeek() async {
        let coach = FakeCoach(.success(proposalReply))
        let vm = await sent(coach)
        await vm.send(.applyTapped(proposalID: "p1"))?.value
        #expect(vm.state.messages[1].proposal?.status == .applied)
        #expect(await coach.actions == ["apply p1"])
        #expect(vm.state.busyProposal == nil)
        #expect(plan.refreshCount == 1)
    }

    @Test func aStaleProposalShowsAsExpiredAndWeekStays() async {
        let coach = FakeCoach(.success(proposalReply))
        await coach.setApplyAnswer(.expired)
        let vm = await sent(coach)
        await vm.send(.applyTapped(proposalID: "p1"))?.value
        #expect(vm.state.messages[1].proposal?.status == .expired)
        #expect(plan.refreshCount == 0)
    }

    @Test func aFailedApplyPutsTheCardBackAndSaysWhy() async {
        let coach = FakeCoach(.success(proposalReply))
        await coach.setFailsApply()
        let vm = await sent(coach)
        await vm.send(.applyTapped(proposalID: "p1"))?.value
        #expect(vm.state.messages[1].proposal?.status == .pending)
        #expect(vm.state.messages[1].proposal?.result.count == 1)
        #expect(vm.state.busyProposal == nil)
    }

    @Test func retryOfAPhotoOnlyMessageSendsItsPhotosAgain() {
        var state = CoachState()
        state.append(.mine("Earlier"))
        state.append(.coach(CoachReply(text: "Ok")))
        state.append(.mine(""), files: [CoachFile(id: "f1", kind: .image, name: "Photo")])
        #expect(state.lastSent?.text == "")
        #expect(state.lastSent?.files.map(\.id) == ["f1"])
        #expect(CoachState().lastSent == nil)
    }

    @Test func undoTappedTakesTheChangesBack() async {
        let coach = FakeCoach(.success(proposalReply))
        let vm = await sent(coach)
        await vm.send(.applyTapped(proposalID: "p1"))?.value
        await vm.send(.undoTapped(proposalID: "p1"))?.value
        #expect(vm.state.messages[1].proposal?.status == .undone)
        #expect(await coach.actions == ["apply p1", "undo p1"])
        #expect(plan.refreshCount == 2)
    }

    @Test func dismissTappedDismissesTheProposal() async {
        let coach = FakeCoach(.success(proposalReply))
        let vm = await sent(coach)
        await vm.send(.dismissTapped(proposalID: "p1"))?.value
        #expect(vm.state.messages[1].proposal?.status == .dismissed)
        #expect(await coach.actions == ["dismiss p1"])
    }

    @Test func aNewProposalSupersedesTheOpenOne() async {
        let coach = FakeCoach(.success(proposalReply))
        let vm = await sent(coach)
        var second = proposalReply
        second.proposal = CoachProposal(id: "p2", title: "Another", items: [])
        await coach.setReply(.success(second))
        vm.send(.draftChanged("Again"))
        await vm.send(.sendTapped)?.value
        #expect(vm.state.messages[1].proposal?.status == .superseded)
        #expect(vm.state.messages[3].proposal?.status == .pending)
    }

    @Test func quickReplyTappedSendsTheAnswer() async {
        let vm = make(FakeCoach(.success(proposalReply)))
        await vm.send(.quickReplyTapped("Tuesday 09:00"))?.value
        #expect(vm.state.messages.first?.body == .mine("Tuesday 09:00"))
        #expect(vm.state.messages.count == 2)
    }

    @Test func workoutOpenedOpensThePlannedWorkout() {
        let vm = make(FakeCoach(.success(proposalReply)))
        vm.send(.workoutOpened("w1"))
        #expect(router.opened == [.plannedWorkout("w1")])
    }

    @Test func exerciseOpenedOpensTheExercisePage() {
        let vm = make(FakeCoach(.success(proposalReply)))
        vm.send(.exerciseOpened("rdl"))
        #expect(router.opened == [.liftExercise("rdl")])
    }

    @Test func weekOpenedAndTodayOpenedSwitchTabs() {
        let vm = make(FakeCoach(.success(proposalReply)))
        vm.send(.weekOpened)
        vm.send(.todayOpened)
        #expect(tabs.shown == [.week, .today])
    }

    @Test func mediaNeededLoadsEachPictureOnce() async throws {
        let vm = make(FakeCoach(.success(proposalReply)))
        let url = try #require(URL(string: "https://example.com/rdl.png"))
        await vm.send(.mediaNeeded(url))?.value
        #expect(vm.send(.mediaNeeded(url)) == nil)
        #expect(vm.state.media[url] == .loaded(LiftSessionMediaLoader.bytes))
        #expect(media.requested == [url])
    }
}
