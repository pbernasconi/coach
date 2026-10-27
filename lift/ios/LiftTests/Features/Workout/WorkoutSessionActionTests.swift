import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// The Workout screen's session-level Actions: add, move and remove exercises, finish, the summary, discard and Save
/// as template. One test per Action case (TEST-2); writes are awaited through `send(...)?.value` (TEST-3).
@MainActor
@Suite struct WorkoutSessionActionTests {
    let router = RecordingNavigator()
    let health = RecordingHealthRecorder()

    /// A planned session with two exercises: the builder's squat, then a bench press.
    var detail: SessionDetail {
        var detail = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 2)
        let bench = SessionExerciseRecord(
            id: IDSequence.id(2, prefix: 0xB0),
            sessionID: detail.id,
            slot: ExerciseSlot(exercise: Fixtures.dumbbellBench),
            position: 1,
            createdAt: ManualNow.start,
            updatedAt: ManualNow.start
        )
        detail.items.append(SessionDetail.Item(exercise: bench, sets: []))
        return detail
    }

    var squatID: UUID { detail.items[0].id }
    var benchID: UUID { detail.items[1].id }

    func loaded(
        sessions: FakeSessionDetailRepository? = nil,
        templates: FakeTemplateRepository = FakeTemplateRepository()
    ) async -> (WorkoutViewModel, FakeSessionDetailRepository) {
        let sessions = sessions ?? FakeSessionDetailRepository(emissions: [detail])
        let vm = WorkoutViewModel(
            sessionID: detail.id,
            sessions: sessions,
            sets: RecordingSetRepository(result: detail.items[0].sets[0]),
            templates: templates,
            router: router,
            clock: ImmediateClock(),
            restActivity: RecordingRestActivityController(),
            catalog: FakeExerciseCatalog(),
            history: FakeExerciseHistoryRepository(emissions: [[]]),
            health: health,
            gym: InMemoryGymSettings(.standard),
            preferences: InMemoryWorkoutSettings(),
            events: RecordingWorkoutEvents(),
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )
        await vm.run()
        return (vm, sessions)
    }

    @Test func addExerciseTappedOpensThePickerForThisSession() async {
        let (vm, _) = await loaded()

        #expect(vm.send(.addExerciseTapped) == nil)
        #expect(router.opened == [.exercisePicker(.session(detail.id))])
    }

    @Test func workoutOptionsTappedOpensTheWorkoutsOptions() async {
        let (vm, _) = await loaded()

        vm.send(.workoutOptionsTapped)

        #expect(vm.state.options == .workout(title: "Lower A", hasNote: false))
    }

    @Test func exerciseOptionsTappedOpensThatExercisesOptions() async {
        let (vm, _) = await loaded()

        vm.send(.exerciseOptionsTapped(benchID))

        let expected = WorkoutExerciseOptions(
            id: benchID,
            name: Fixtures.dumbbellBench.name,
            canMoveUp: true,
            canMoveDown: false
        )
        #expect(vm.state.options == .exercise(expected))
    }

    @Test func optionsDismissedClosesTheSheet() async {
        let (vm, _) = await loaded()
        vm.send(.workoutOptionsTapped)

        vm.send(.optionsDismissed)

        #expect(vm.state.options == nil)
    }

    @Test func exerciseMoveUpTappedSwapsWithThePreviousExercise() async {
        let (vm, sessions) = await loaded()

        await vm.send(.exerciseMoveUpTapped(benchID))?.value

        #expect(sessions.calls == [.reorder(detail.id, [benchID, squatID])])
    }

    @Test func exerciseMoveDownTappedSwapsWithTheNextExercise() async {
        let (vm, sessions) = await loaded()

        await vm.send(.exerciseMoveDownTapped(squatID))?.value
        await vm.send(.exerciseMoveDownTapped(benchID))?.value  // already last: nothing to write

        #expect(sessions.calls == [.reorder(detail.id, [benchID, squatID])])
    }

    @Test func exerciseRemoveTappedRemovesAtOnceAndOffersUndo() async {
        let (vm, sessions) = await loaded()

        await vm.send(.exerciseRemoveTapped(benchID))?.value

        #expect(sessions.calls == [.removeExercise(benchID)])
        #expect(vm.state.toast?.kind == .exerciseRemoved(benchID))
    }

    @Test func exerciseRemoveUndoTappedRestoresTheExercise() async {
        let (vm, sessions) = await loaded()

        await vm.send(.exerciseRemoveUndoTapped(benchID))?.value

        #expect(sessions.calls == [.restoreExercise(benchID)])
        #expect(vm.state.toast == nil)
    }

    @Test func finishTappedWithSetsLeftAsksFirst() async {
        let (vm, sessions) = await loaded()

        #expect(vm.send(.finishTapped) == nil)

        #expect(vm.state.isConfirmingFinish)
        #expect(vm.state.plannedSetsLeft == 2)
        #expect(sessions.calls.isEmpty)
    }

    @Test func finishCancelledKeepsTheWorkoutGoing() async {
        let (vm, sessions) = await loaded()
        vm.send(.finishTapped)

        vm.send(.finishCancelled)

        #expect(!vm.state.isConfirmingFinish)
        #expect(sessions.calls.isEmpty)
    }

    @Test func finishTappedWithEverySetDoneFinishesWithoutAsking() async {
        var done = detail
        for index in done.items[0].sets.indices { done.items[0].sets[index].status = .done }
        let (vm, sessions) = await loaded(sessions: FakeSessionDetailRepository(emissions: [done]))

        await vm.send(.finishTapped)?.value

        #expect(!vm.state.isConfirmingFinish)
        #expect(sessions.calls == [.finish(detail.id)])
    }

    @Test func finishConfirmedFinishesAndOpensTheSummaryWithoutLoggingAnything() async {
        let (vm, sessions) = await loaded()
        vm.send(.finishTapped)

        let first = vm.send(.finishConfirmed)
        let second = vm.send(.finishConfirmed)  // a double tap finishes once
        await first?.value

        #expect(second == nil)
        #expect(sessions.calls == [.finish(detail.id)])
        #expect(router.opened == [.workoutSummary(detail.id)])
        #expect(health.calls == [.finished(detail.id)])
    }

    @Test func aFailedFinishSaysSo() async {
        let (vm, _) = await loaded(
            sessions: FakeSessionDetailRepository(emissions: [detail], writeError: AppError(.unknown))
        )

        await vm.send(.finishConfirmed)?.value

        #expect(router.opened.isEmpty)
        #expect(vm.state.toast?.kind == .failed)
        #expect(health.calls.isEmpty)
    }

    @Test func summaryTappedOpensTheSummary() async {
        let (vm, _) = await loaded()

        #expect(vm.send(.summaryTapped) == nil)
        #expect(router.opened == [.workoutSummary(detail.id)])
    }

    @Test func discardTappedRemovesTheSessionAndOffersUndo() async {
        let (vm, sessions) = await loaded()

        await vm.send(.discardTapped)?.value

        #expect(sessions.calls == [.reschedule(detail.id, .remove)])
        let undo = RescheduleUndo(sessionID: detail.id, previousDay: Fixtures.monday)
        #expect(vm.state.toast?.kind == .discarded(undo))
        #expect(health.calls == [.removed(detail.id)])
        #expect(router.backCount == 0)  // the page closes once the toast is up
    }

    @Test func discardedToastShownGoesBackToWhereTheWorkoutWasOpened() async {
        let (vm, _) = await loaded()

        #expect(vm.send(.discardedToastShown) == nil)

        #expect(router.backCount == 1)
    }

    @Test func discardUndoTappedPutsTheSessionBack() async {
        let (vm, sessions) = await loaded()
        let undo = RescheduleUndo(sessionID: detail.id, previousDay: Fixtures.monday)

        await vm.send(.discardUndoTapped(undo))?.value

        #expect(sessions.calls == [.undo(undo)])
        #expect(health.calls == [.restored(detail.id)])
    }

    @Test func undoWorksAfterTheSessionLeftTheStore() async {
        let (vm, sessions) = await loaded(sessions: FakeSessionDetailRepository(emissions: [nil]))
        let undo = RescheduleUndo(sessionID: detail.id, previousDay: Fixtures.monday)

        await vm.send(.discardUndoTapped(undo))?.value

        #expect(sessions.calls == [.undo(undo)])
    }

    @Test func saveAsTemplateTappedNamesTheTemplateAfterTheSession() async {
        let templates = FakeTemplateRepository()
        let (vm, _) = await loaded(templates: templates)

        await vm.send(.saveAsTemplateTapped)?.value

        #expect(templates.calls == [.saveAsTemplate(detail.id, "Lower A")])
        #expect(vm.state.toast?.kind == .savedAsTemplate(name: "Lower A"))
    }

    @Test func theHeaderSaysWhenTheWorkoutStartedAndFinished() {
        var started = SessionBuilder.session(id: 3, on: Fixtures.monday, done: 1, planned: 1)
        started.items[0].sets[0].completedAt = ManualNow.start
        let days = DayCalendar(calendar: SessionBuilder.calendar)
        let overview = WorkoutOverview(detail: started, days: days, previous: [:], gym: .standard)
        #expect(overview.started == days.started(at: ManualNow.start))
        #expect(!overview.isFinished)
        started.session.finishedAt = ManualNow.start
        #expect(WorkoutOverview(detail: started, days: days, previous: [:], gym: .standard).isFinished)
    }
}
