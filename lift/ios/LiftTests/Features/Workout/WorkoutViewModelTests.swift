import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// One test per Action case and the rest countdown; `run()` is in `WorkoutRunTests` (TEST-2). No sleeps, no real time (TEST-3).
@MainActor
@Suite struct WorkoutViewModelTests {
    let planned = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 3)
    let started = SessionBuilder.session(id: 2, on: Fixtures.monday, done: 1, planned: 2)
    let clock = ImmediateClock()
    let router = RecordingNavigator()

    func makeViewModel(
        _ detail: SessionDetail,
        sets: RecordingSetRepository,
        catalog: FakeExerciseCatalog = FakeExerciseCatalog()
    ) -> WorkoutViewModel {
        WorkoutViewModel(
            sessionID: detail.id,
            sessions: FakeSessionDetailRepository(emissions: [detail]),
            sets: sets,
            templates: FakeTemplateRepository(),
            router: router,
            clock: clock,
            restActivity: RecordingRestActivityController(),
            catalog: catalog,
            history: FakeExerciseHistoryRepository(emissions: [[]]),
            health: RecordingHealthRecorder(),
            gym: InMemoryGymSettings(.standard),
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )
    }

    func recorder(_ detail: SessionDetail, error: AppError? = nil) -> RecordingSetRepository {
        RecordingSetRepository(result: detail.items[0].sets[0], error: error)
    }

    func firstSetID(_ detail: SessionDetail) -> UUID { detail.items[0].sets[0].id }

    @Test func setLogTappedLogsInOneTapOnceAndStartsTheRest() async {
        let sets = recorder(planned)
        let vm = makeViewModel(planned, sets: sets)
        await vm.run()

        let first = vm.send(.setLogTapped(firstSetID(planned)))
        let second = vm.send(.setLogTapped(firstSetID(planned)))
        await first?.value

        #expect(second == nil)
        #expect(sets.calls == [.log(firstSetID(planned))])
        #expect(vm.state.rest == RestTimer(run: 1, seconds: RestTimer.defaultSeconds, setID: firstSetID(planned)))
    }

    @Test func setLogTappedDuringARestRestartsItFromFullForTheNewSet() async {
        let vm = makeViewModel(planned, sets: recorder(planned))
        await vm.run()
        await vm.send(.setLogTapped(firstSetID(planned)))?.value
        vm.send(.restExtendTapped)
        let second = planned.items[0].sets[1].id

        await vm.send(.setLogTapped(second))?.value

        #expect(vm.state.rest == RestTimer(run: 2, seconds: RestTimer.defaultSeconds, setID: second))
    }

    @Test func setLogTappedOnALoggedSetUnlogsIt() async {
        let sets = recorder(started)
        let vm = makeViewModel(started, sets: sets)
        await vm.run()

        await vm.send(.setLogTapped(firstSetID(started)))?.value

        #expect(sets.calls == [.unlog(firstSetID(started))])
        #expect(vm.state.rest == nil)
    }

    @Test func setLogTappedFailureShowsAToast() async {
        let vm = makeViewModel(planned, sets: recorder(planned, error: AppError(.unknown)))
        await vm.run()

        await vm.send(.setLogTapped(firstSetID(planned)))?.value

        #expect(vm.state.toast == WorkoutToast(serial: 1, kind: .failed))
        #expect(vm.state.rest == nil)
    }

    @Test func setValuesTappedOpensTheEditorFromTheTarget() async {
        let vm = makeViewModel(planned, sets: recorder(planned))
        await vm.run()

        let task = vm.send(.setValuesTapped(firstSetID(planned)))

        #expect(task == nil)
        let expected = SetEditor(
            id: firstSetID(planned),
            title: "Set 1 · Back squat",
            unit: .kg,
            step: 2.5,
            weight: 100,
            reps: 5,
            savedWeight: 100,
            savedReps: 5,
            lastTime: nil,
            laterSets: 2
        )
        #expect(vm.state.editor == expected)
        #expect(vm.state.editor?.hasChanges == false)
    }

    @Test func editorWeightChangedUpdatesTheDraft() async {
        let vm = makeViewModel(planned, sets: recorder(planned))
        await vm.run()
        vm.send(.setValuesTapped(firstSetID(planned)))

        vm.send(.editorWeightChanged(102.5))

        #expect(vm.state.editor?.weight == 102.5)
        #expect(vm.state.editor?.hasChanges == true)
    }

    @Test func editorRepsChangedUpdatesTheDraft() async {
        let vm = makeViewModel(planned, sets: recorder(planned))
        await vm.run()
        vm.send(.setValuesTapped(firstSetID(planned)))

        vm.send(.editorRepsChanged(6))

        #expect(vm.state.editor?.reps == 6)
        #expect(vm.state.editor?.hasChanges == true)
    }

    @Test func editorDoneTappedSavesValuesAndNeverLogs() async {
        let sets = recorder(planned)
        let vm = makeViewModel(planned, sets: sets)
        await vm.run()
        vm.send(.setValuesTapped(firstSetID(planned)))
        vm.send(.editorApplyToLaterChanged(false))
        vm.send(.editorWeightChanged(102.5))
        vm.send(.editorRepsChanged(6))

        await vm.send(.editorDoneTapped)?.value

        #expect(sets.calls == [.saveValues(setID: firstSetID(planned), reps: 6, weight: .kg(102.5))])
        #expect(vm.state.editor == nil)
        #expect(vm.state.rest == nil)
    }

    @Test func editorApplyToLaterChangedUpdatesTheDraft() async {
        let vm = makeViewModel(planned, sets: recorder(planned))
        await vm.run()
        vm.send(.setValuesTapped(firstSetID(planned)))
        #expect(vm.state.editor?.appliesToLater == true)

        let task = vm.send(.editorApplyToLaterChanged(false))

        #expect(task == nil)
        #expect(vm.state.editor?.appliesToLater == false)
        #expect(vm.state.editor?.hasChanges == false)
    }

    @Test func editorDismissedClosesWithoutSaving() async {
        let sets = recorder(planned)
        let vm = makeViewModel(planned, sets: sets)
        await vm.run()
        vm.send(.setValuesTapped(firstSetID(planned)))
        vm.send(.editorRepsChanged(6))

        let task = vm.send(.editorDismissed)

        #expect(task == nil)
        #expect(vm.state.editor == nil)
        #expect(sets.calls.isEmpty)
    }

    @Test func setSkipTappedSkipsTheSet() async {
        let sets = recorder(planned)
        let vm = makeViewModel(planned, sets: sets)
        await vm.run()

        await vm.send(.setSkipTapped(firstSetID(planned)))?.value

        #expect(sets.calls == [.skip(firstSetID(planned))])
    }

    @Test func setRemoveTappedRemovesAndOffersUndo() async {
        let sets = recorder(planned)
        let vm = makeViewModel(planned, sets: sets)
        await vm.run()

        await vm.send(.setRemoveTapped(firstSetID(planned)))?.value

        #expect(sets.calls == [.remove(firstSetID(planned))])
        #expect(vm.state.toast == WorkoutToast(serial: 1, kind: .removed(setID: firstSetID(planned))))
    }

    @Test func removeUndoTappedRestoresTheSet() async {
        let sets = recorder(planned)
        let vm = makeViewModel(planned, sets: sets)
        await vm.run()

        await vm.send(.removeUndoTapped(firstSetID(planned)))?.value

        #expect(sets.calls == [.restore(firstSetID(planned))])
    }

    @Test func addSetTappedCopiesTheLastWorkingTarget() async {
        let sets = recorder(planned)
        let vm = makeViewModel(planned, sets: sets)
        await vm.run()
        let exerciseID = planned.items[0].id

        await vm.send(.addSetTapped(exerciseID: exerciseID))?.value

        #expect(sets.calls == [.addSet(sessionExerciseID: exerciseID, kind: .working, target: Fixtures.fiveAt100)])
    }

    @Test func restExtendTappedAddsThirtySeconds() async {
        let vm = makeViewModel(planned, sets: recorder(planned))
        await vm.run()
        await vm.send(.setLogTapped(firstSetID(planned)))?.value

        vm.send(.restExtendTapped)

        #expect(vm.state.rest == RestTimer(run: 1, seconds: 90, setID: firstSetID(planned)).extended(by: 30))
        #expect(vm.state.rest?.remaining == 120)
    }

    @Test func restSkipTappedEndsTheRest() async {
        let vm = makeViewModel(planned, sets: recorder(planned))
        await vm.run()
        await vm.send(.setLogTapped(firstSetID(planned)))?.value

        vm.send(.restSkipTapped)

        #expect(vm.state.rest == nil)
    }

    @Test func howToTappedOpensTheExerciseDetail() async {
        let vm = makeViewModel(planned, sets: recorder(planned))
        await vm.run()

        let task = vm.send(.howToTapped(exerciseID: Fixtures.squat.id))

        #expect(task == nil)
        #expect(router.opened == [.exercise(Fixtures.squat.id)])
    }

    @Test func runRestTimerCountsDownOnTheInjectedClock() async {
        let vm = makeViewModel(planned, sets: recorder(planned))
        await vm.run()
        await vm.send(.setLogTapped(firstSetID(planned)))?.value

        await vm.runRestTimer()

        #expect(vm.state.rest == nil)
        #expect(clock.sleepCount == RestTimer.defaultSeconds)
    }

    @Test func thumbnailNeededLoadsTheStillOnce() async {
        let still = MediaImage.loaded(FakeExerciseCatalog.imageData)
        let catalog = FakeExerciseCatalog(
            entries: [FakeExerciseCatalog.entry("0043", "Squat")],
            images: ["0043": still]
        )
        let vm = makeViewModel(planned, sets: recorder(planned), catalog: catalog)

        let task = vm.send(.thumbnailNeeded(catalogID: "0043"))
        #expect(vm.state.thumbnails["0043"] == .loading)
        #expect(vm.send(.thumbnailNeeded(catalogID: "0043")) == nil)
        await task?.value

        #expect(vm.state.thumbnails["0043"] == still)
        #expect(catalog.imageRequests.count == 1)
    }
}
