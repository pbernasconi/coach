import Foundation
import KoboComponents
import Testing

@testable import Lift

/// A coach that answers at once with a set reply, or fails; it records applies and undos.
private actor FakeCoach: CoachChatting {
    var reply: Result<CoachReply, CoachChatError>
    private(set) var applied: [String] = []
    private(set) var undone: [String] = []
    var failsApply = false

    init(_ reply: Result<CoachReply, CoachChatError>) { self.reply = reply }

    func reply(to text: String, after history: [CoachMessage]) async throws -> CoachReply { try reply.get() }

    func apply(_ proposalID: String) async throws {
        if failsApply { throw CoachChatError(message: "no") }
        applied.append(proposalID)
    }

    func undo(_ proposalID: String) async throws { undone.append(proposalID) }

    func setReply(_ new: Result<CoachReply, CoachChatError>) { reply = new }
    func setFailsApply() { failsApply = true }
}

private let proposalReply = CoachReply(
    text: "Moved it.",
    steps: [CoachChatStep(id: "s", text: "Read this week's plan")],
    proposal: CoachProposal(
        id: "p1",
        title: "1 change",
        items: [ChatActionItem(id: "a", change: .move, title: "Lift", detail: "Tue", previous: "Mon")]
    )
)

/// One test per Action (TEST-2).
@MainActor
@Suite struct CoachViewModelTests {
    private func sent(_ coach: FakeCoach, _ text: String = "Move the lift") async -> CoachViewModel {
        let vm = CoachViewModel(coach: coach)
        vm.send(.draftChanged(text))
        await vm.send(.sendTapped)?.value
        return vm
    }

    @Test func draftChangedKeepsTheDraft() {
        let vm = CoachViewModel(coach: FakeCoach(.success(proposalReply)))
        vm.send(.draftChanged("hi"))
        #expect(vm.state.draft == "hi")
    }

    @Test func promptPickedFillsTheComposerWithoutSending() {
        let vm = CoachViewModel(coach: FakeCoach(.success(proposalReply)))
        vm.send(.promptPicked(vm.state.prompts[0]))
        #expect(vm.state.draft == vm.state.prompts[0].title)
        #expect(vm.state.messages.isEmpty)
    }

    @Test func sendTappedPostsTheMessageAndTheReply() async {
        let vm = await sent(FakeCoach(.success(proposalReply)), "  Move the lift \n")
        #expect(vm.state.messages.map(\.id) == ["m0", "m1"])
        #expect(vm.state.messages[0].body == .mine("Move the lift"))
        #expect(vm.state.messages[1].proposal?.status == .pending)
        #expect(vm.state.draft.isEmpty)
        #expect(vm.state.phase == .idle)
    }

    @Test func sendTappedIgnoresABlankDraft() {
        let vm = CoachViewModel(coach: FakeCoach(.success(proposalReply)))
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
        let vm = CoachViewModel(coach: FakeCoach(.success(proposalReply)))
        vm.send(.draftChanged("hi"))
        vm.send(.sendTapped)
        #expect(vm.state.isResponding)
        vm.send(.stopTapped)
        #expect(vm.state.phase == .idle)
    }

    @Test func applyTappedAppliesTheProposal() async {
        let coach = FakeCoach(.success(proposalReply))
        let vm = await sent(coach)
        await vm.send(.applyTapped(proposalID: "p1"))?.value
        #expect(vm.state.messages[1].proposal?.status == .applied)
        #expect(await coach.applied == ["p1"])
        #expect(vm.state.busyProposal == nil)
    }

    @Test func aFailedApplyPutsTheCardBack() async {
        let coach = FakeCoach(.success(proposalReply))
        await coach.setFailsApply()
        let vm = await sent(coach)
        await vm.send(.applyTapped(proposalID: "p1"))?.value
        #expect(vm.state.messages[1].proposal?.status == .pending)
    }

    @Test func undoTappedTakesTheChangesBack() async {
        let coach = FakeCoach(.success(proposalReply))
        let vm = await sent(coach)
        await vm.send(.applyTapped(proposalID: "p1"))?.value
        await vm.send(.undoTapped(proposalID: "p1"))?.value
        #expect(vm.state.messages[1].proposal?.status == .pending)
        #expect(await coach.undone == ["p1"])
    }

    @Test func dismissTappedDismissesTheProposal() async {
        let vm = await sent(FakeCoach(.success(proposalReply)))
        vm.send(.dismissTapped(proposalID: "p1"))
        #expect(vm.state.messages[1].proposal?.status == .dismissed)
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
}
