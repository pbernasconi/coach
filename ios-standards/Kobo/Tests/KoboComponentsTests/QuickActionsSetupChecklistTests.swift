import Testing

@testable import KoboComponents

@Suite struct QuickActionsSetupChecklistTests {
    private func steps(done: Int, of count: Int = 3) -> [SetupChecklistStep] {
        (0..<count).map { SetupChecklistStep(id: "step-\($0)", title: "Step \($0)", isDone: $0 < done) }
    }

    @Test func progressCountsDoneStepsAndExtraSteps() {
        #expect(SetupChecklistProgress.doneCount(steps(done: 2)) == 2)
        #expect(SetupChecklistProgress.stepCount(steps(done: 2), totalSteps: nil) == 3)
        #expect(SetupChecklistProgress.stepCount(steps(done: 2), totalSteps: 5) == 5)
        #expect(SetupChecklistProgress.stepCount(steps(done: 2), totalSteps: 1) == 3)
        #expect(SetupChecklistProgress.segmentFills(steps(done: 1), totalSteps: 4) == [true, false, false, false])
    }

    @Test func aChecklistIsCompleteOnlyWhenEveryCountedStepIsDone() {
        #expect(SetupChecklistProgress.isComplete(steps(done: 3), totalSteps: nil))
        #expect(!SetupChecklistProgress.isComplete(steps(done: 3), totalSteps: 4))
        #expect(!SetupChecklistProgress.isComplete([], totalSteps: nil))
    }

    @Test func theFirstStepsShowAtOnce() {
        let change = SetupChecklistPresentation<[SetupChecklistStep]>().received(steps(done: 1))
        #expect(change.next.shown == steps(done: 1))
        #expect(!change.animates)
    }

    @Test func aLiveChangeWaitsUntilThePageSettles() {
        let onScreen = SetupChecklistPresentation<[SetupChecklistStep]>().received(steps(done: 1)).next.pageSettled()
            .next
        let covered = onScreen.pageLeft().received(steps(done: 2))
        #expect(covered.next.shown == steps(done: 1))
        #expect(!covered.animates)
        let settled = covered.next.pageSettled()
        #expect(settled.next.shown == steps(done: 2))
        #expect(settled.next.pending == nil)
        #expect(settled.animates)
        let live = settled.next.received(steps(done: 3))
        #expect(live.next.shown == steps(done: 3))
        #expect(live.animates)
    }

    @Test func anUnchangedListNeverAnimates() {
        let onScreen = SetupChecklistPresentation<[SetupChecklistStep]>().received(steps(done: 1)).next
            .pageSettled().next
        #expect(!onScreen.received(steps(done: 1)).animates)
        #expect(!onScreen.pageSettled().animates)
    }
}
