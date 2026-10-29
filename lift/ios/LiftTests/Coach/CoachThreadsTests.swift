import Foundation
import KoboComponents
import Testing

@testable import Lift

private let questionReply = CoachReply(
    text: "A few questions first.",
    questions: [
        ChatQuestion(id: "days", title: "Which days are you away?", kind: .single(options: ["Thu–Sun", "Fri–Sun"])),
        ChatQuestion(id: "kit", title: "What can you train with?", kind: .multi(options: ["Pool", "Bike"])),
        ChatQuestion(id: "test", title: "Move the test?", kind: .confirm(primary: "Move it")),
    ]
)

/// The Ramp-style chat's Actions: thumbs, question cards, the top bar and the history sheet (one test each, TEST-2).
@MainActor
@Suite struct CoachThreadsTests {
    let tabs = RecordingTabs()

    private func make(_ coach: FakeCoach) -> CoachViewModel {
        CoachViewModel(
            coach: coach, plan: FakeCoachPlan([]), router: RecordingNavigator(), tabs: tabs,
            mediaLoader: LiftSessionMediaLoader(), speech: FakeSpeech(), clock: ImmediateClock(),
            settings: RecordingAppSettings(), presence: CoachPresence()
        )
    }

    private func loaded(_ reply: CoachReply, coach: FakeCoach) async -> CoachViewModel {
        await coach.setThread(
            CoachThread(
                messages: [CoachMessage(id: "m1", body: .mine("Plan my week")), CoachMessage(id: "m2", body: .coach(reply))],
                firstName: "Sam"
            )
        )
        let vm = make(coach)
        await vm.run()
        return vm
    }

    @Test func runKeepsTheFirstNameForTheGreeting() async {
        let vm = await loaded(questionReply, coach: FakeCoach(.success(questionReply)))
        #expect(vm.state.firstName == "Sam")
        #expect(vm.state.greeting == "Hi Sam,")
        #expect(vm.state.openQuestions.count == 3)
    }

    @Test func feedbackTappedFillsTheThumbAndSendsIt() async {
        let coach = FakeCoach(.success(questionReply))
        let vm = await loaded(questionReply, coach: coach)
        await vm.send(.feedbackTapped(messageID: "m2", rating: .up))?.value
        #expect(vm.state.feedback(of: "m2") == .up)
        #expect(await coach.ratings == ["m2 up"])
    }

    @Test func aFailedThumbGoesBack() async {
        let coach = FakeCoach(.success(questionReply))
        let vm = await loaded(questionReply, coach: coach)
        await coach.setFailsRate()
        await vm.send(.feedbackTapped(messageID: "m2", rating: .down))?.value
        #expect(vm.state.feedback(of: "m2") == nil)
    }

    @Test func questionsAnsweredSendsOneMessageALinePerQuestion() async {
        let coach = FakeCoach(.success(CoachReply(text: "Thanks")))
        let vm = await loaded(questionReply, coach: coach)
        await vm.send(
            .questionsAnswered(["days": .choices(["Thu–Sun"]), "kit": .choices(["Pool", "Bike"]), "test": .skipped])
        )?.value
        #expect(
            vm.state.messages[2].body
                == .mine("Which days are you away?: Thu–Sun\nWhat can you train with?: Pool, Bike\nMove the test?: skip")
        )
        #expect(vm.state.openQuestions.isEmpty)
    }

    @Test func closeTappedGoesBackToTheTabBeforeCoach() {
        let vm = make(FakeCoach(.success(questionReply)))
        vm.send(.closeTapped)
        #expect(tabs.shown == [.today])
    }

    @Test func breakdownOpenedShowsItsPage() {
        let vm = make(FakeCoach(.success(questionReply)))
        vm.send(.breakdownOpened("plan"))
        vm.send(.breakdownOpened("lift"))
        #expect(tabs.shown == [.week, .lift])
    }

    @Test func historyShownLoadsThePastChatsAndClosesAgain() async {
        let coach = FakeCoach(.success(questionReply))
        let past = [CoachThreadSummary(id: "t1", title: "Plan my week", updatedAt: nil, messageCount: 4)]
        await coach.setPast(past)
        let vm = make(coach)
        await vm.send(.historyShown(true))?.value
        #expect(vm.state.history == .loaded(past))
        vm.send(.historyShown(false))
        #expect(vm.state.history == .closed)
    }

    @Test func newChatTappedStartsAnEmptyChat() async {
        let coach = FakeCoach(.success(questionReply))
        let vm = await loaded(questionReply, coach: coach)
        await vm.send(.newChatTapped)?.value
        #expect(vm.state.messages.isEmpty)
        #expect(vm.state.notice == "Fresh")
        #expect(await coach.actions == ["new"])
    }

    @Test func threadPickedOpensThatChatAndClosesTheSheet() async {
        let coach = FakeCoach(.success(questionReply))
        let vm = make(coach)
        vm.send(.historyShown(true))
        await coach.setThread(CoachThread(messages: [CoachMessage(id: "old", body: .mine("Earlier"))]))
        await vm.send(.threadPicked("t1"))?.value
        #expect(vm.state.messages.map(\.id) == ["old"])
        #expect(vm.state.history == .closed)
        #expect(await coach.actions == ["open t1"])
    }

    @Test func confirmAndTextAnswersReadAsTheirLabel() {
        #expect(CoachQuestionText.text(for: .button("Move it")) == "Move it")
        #expect(CoachQuestionText.text(for: .text("Early flight")) == "Early flight")
    }
}
