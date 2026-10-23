import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// Writing notes and RPE on the Workout screen: one test per note and RPE Action (TEST-2). Made-up sessions only
/// (TEST-8); no sleeps (TEST-3).
@MainActor
@Suite struct WorkoutNoteEditingTests {
    let planned = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 3)

    func makeViewModel(
        _ detail: SessionDetail,
        sets: RecordingSetRepository,
        sessions: FakeSessionDetailRepository? = nil
    ) -> WorkoutViewModel {
        WorkoutViewModel(
            sessionID: detail.id,
            sessions: sessions ?? FakeSessionDetailRepository(emissions: [detail]),
            sets: sets,
            templates: FakeTemplateRepository(),
            router: RecordingNavigator(),
            clock: ImmediateClock(),
            restActivity: RecordingRestActivityController(),
            catalog: FakeExerciseCatalog(),
            history: FakeExerciseHistoryRepository(emissions: [[]]),
            health: RecordingHealthRecorder(),
            gym: InMemoryGymSettings(.standard),
            preferences: InMemoryWorkoutSettings(),
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )
    }

    func recorder(_ detail: SessionDetail) -> RecordingSetRepository {
        RecordingSetRepository(result: detail.items[0].sets[0])
    }

    var firstSetID: UUID { planned.items[0].sets[0].id }

    @Test func theEditorOpensWithTheSetsRPEAndNote() async {
        var detail = planned
        detail.items[0].sets[0].rpe = 8.5
        detail.items[0].sets[0].note = "paused"
        let vm = makeViewModel(detail, sets: recorder(detail))
        await vm.run()

        vm.send(.setValuesTapped(firstSetID))

        #expect(vm.state.editor?.rpe == 8.5)
        #expect(vm.state.editor?.note == "paused")
        #expect(vm.state.editor?.hasChanges == false)
    }

    @Test func editorRPEChangedChoosesAValueAndTheSameValueClearsIt() async {
        let vm = makeViewModel(planned, sets: recorder(planned))
        await vm.run()
        vm.send(.setValuesTapped(firstSetID))

        #expect(vm.send(.editorRPEChanged(8)) == nil)
        #expect(vm.state.editor?.rpe == 8)
        #expect(vm.state.editor?.hasChanges == true)
        vm.send(.editorRPEChanged(9.5))
        #expect(vm.state.editor?.rpe == 9.5)
        vm.send(.editorRPEChanged(9.5))
        #expect(vm.state.editor?.rpe == nil)
        vm.send(.editorRPEChanged(11))
        #expect(vm.state.editor?.rpe == nil)
    }

    @Test func editorNoteChangedUpdatesTheDraft() async {
        let vm = makeViewModel(planned, sets: recorder(planned))
        await vm.run()
        vm.send(.setValuesTapped(firstSetID))

        #expect(vm.send(.editorNoteChanged("Belt on")) == nil)

        #expect(vm.state.editor?.note == "Belt on")
        #expect(vm.state.editor?.hasValueChanges == false)
        #expect(vm.state.editor?.hasChanges == true)
    }

    @Test func editorDoneTappedWithOnlyRPEAndNoteSavesThemAndNeverLogs() async {
        let sets = recorder(planned)
        let vm = makeViewModel(planned, sets: sets)
        await vm.run()
        vm.send(.setValuesTapped(firstSetID))
        vm.send(.editorRPEChanged(8))
        vm.send(.editorNoteChanged("Belt on"))

        await vm.send(.editorDoneTapped)?.value

        #expect(sets.calls == [.saveDetails(setID: firstSetID, rpe: 8, note: "Belt on")])
        #expect(vm.state.editor == nil)
        #expect(vm.state.rest == nil)
    }

    @Test func editorDoneTappedWithValuesAndRPESavesBoth() async {
        let sets = recorder(planned)
        let vm = makeViewModel(planned, sets: sets)
        await vm.run()
        vm.send(.setValuesTapped(firstSetID))
        vm.send(.editorApplyToLaterChanged(false))
        vm.send(.editorRepsChanged(4))
        vm.send(.editorRPEChanged(9))

        await vm.send(.editorDoneTapped)?.value

        #expect(
            sets.calls == [
                .saveValues(setID: firstSetID, reps: 4, weight: .kg(100)),
                .saveDetails(setID: firstSetID, rpe: 9, note: ""),
            ]
        )
    }

    @Test func aLoggedSetStillLogsInOneTapWithoutRPE() async {
        let sets = recorder(planned)
        let vm = makeViewModel(planned, sets: sets)
        await vm.run()

        await vm.send(.setLogTapped(firstSetID))?.value

        #expect(sets.calls == [.log(firstSetID)])
    }

    @Test func theSetRowShowsTheRPE() {
        var detail = planned
        detail.items[0].sets[0].rpe = 8.5
        detail.items[0].sets[0].note = "paused"
        let overview = WorkoutOverview(
            detail: detail,
            days: DayCalendar(calendar: SessionBuilder.calendar),
            previous: [:],
            gym: .standard
        )
        let rows = overview.exercises.first?.sets ?? []
        #expect(rows.map(\.rpe) == ["RPE 8.5", nil, nil])
        #expect(WorkoutText.setDetail(rpe: rows[0].rpe, note: rows[0].note) == "RPE 8.5 · paused")
        #expect(WorkoutText.setDetail(rpe: nil, note: nil) == nil)
    }

    @Test func sessionNoteTappedOpensTheEditorWithTheNote() async {
        var detail = planned
        detail.session.note = "Short on time"
        let vm = makeViewModel(detail, sets: recorder(detail))
        await vm.run()

        #expect(vm.send(.sessionNoteTapped) == nil)

        let expected = NoteEditor(
            target: .session(detail.id),
            title: "Workout note",
            text: "Short on time",
            savedText: "Short on time"
        )
        #expect(vm.state.noteEditor == expected)
    }

    @Test func exerciseNoteTappedOpensTheStoredNoteAndClosesTheOptions() async {
        var detail = planned
        detail.items[0].exercise.note = "Elbows in"
        let exerciseID = detail.items[0].id
        let vm = makeViewModel(detail, sets: recorder(detail))
        await vm.run()
        vm.send(.exerciseOptionsTapped(exerciseID))
        #expect(vm.state.options == .exercise(WorkoutExerciseOptions(detail: detail, exerciseID: exerciseID)!))
        #expect(WorkoutExerciseOptions(detail: detail, exerciseID: exerciseID)?.hasNote == true)

        vm.send(.exerciseNoteTapped(exerciseID))

        #expect(vm.state.options == nil)
        #expect(vm.state.noteEditor?.target == .exercise(exerciseID))
        #expect(vm.state.noteEditor?.title == "Note · Back squat")
        #expect(vm.state.noteEditor?.text == "Elbows in")
    }

    @Test func noteTextChangedUpdatesTheDraft() async {
        let vm = makeViewModel(planned, sets: recorder(planned))
        await vm.run()
        vm.send(.sessionNoteTapped)

        #expect(vm.send(.noteTextChanged("Slept badly")) == nil)

        #expect(vm.state.noteEditor?.text == "Slept badly")
        #expect(vm.state.noteEditor?.hasChanges == true)
    }

    @Test func noteDoneTappedSavesTheSessionNote() async {
        let sessions = FakeSessionDetailRepository(emissions: [planned])
        let vm = makeViewModel(planned, sets: recorder(planned), sessions: sessions)
        await vm.run()
        vm.send(.sessionNoteTapped)
        vm.send(.noteTextChanged("Slept badly"))

        await vm.send(.noteDoneTapped)?.value

        #expect(sessions.calls == [.saveNote(planned.id, "Slept badly")])
        #expect(vm.state.noteEditor == nil)
    }

    @Test func noteDoneTappedSavesTheExerciseNote() async {
        let sessions = FakeSessionDetailRepository(emissions: [planned])
        let exerciseID = planned.items[0].id
        let vm = makeViewModel(planned, sets: recorder(planned), sessions: sessions)
        await vm.run()
        vm.send(.exerciseNoteTapped(exerciseID))
        vm.send(.noteTextChanged("Wider grip"))

        await vm.send(.noteDoneTapped)?.value

        #expect(sessions.calls == [.saveExerciseNote(exerciseID, "Wider grip")])
    }

    @Test func noteDoneTappedWithoutChangesSavesNothing() async {
        let sessions = FakeSessionDetailRepository(emissions: [planned])
        let vm = makeViewModel(planned, sets: recorder(planned), sessions: sessions)
        await vm.run()
        vm.send(.sessionNoteTapped)

        #expect(vm.send(.noteDoneTapped) == nil)

        #expect(sessions.calls.isEmpty)
        #expect(vm.state.noteEditor == nil)
    }

    @Test func noteDoneTappedFailureShowsAToast() async {
        let sessions = FakeSessionDetailRepository(emissions: [planned], writeError: AppError(.unknown))
        let vm = makeViewModel(planned, sets: recorder(planned), sessions: sessions)
        await vm.run()
        vm.send(.sessionNoteTapped)
        vm.send(.noteTextChanged("Slept badly"))

        await vm.send(.noteDoneTapped)?.value

        #expect(vm.state.toast == WorkoutToast(serial: 1, kind: .failed))
    }

    @Test func noteDismissedClosesWithoutSaving() async {
        let sessions = FakeSessionDetailRepository(emissions: [planned])
        let vm = makeViewModel(planned, sets: recorder(planned), sessions: sessions)
        await vm.run()
        vm.send(.sessionNoteTapped)
        vm.send(.noteTextChanged("Slept badly"))

        #expect(vm.send(.noteDismissed) == nil)

        #expect(vm.state.noteEditor == nil)
        #expect(sessions.calls.isEmpty)
    }
}

/// The exercise history row names the best set's RPE when it was recorded.
@MainActor
@Suite struct ExerciseHistoryRPETests {
    @Test func theBestSetCarriesItsRPE() {
        var set = SessionBuilder.session(id: 3, on: Fixtures.monday, done: 1, planned: 0).items[0].sets[0]
        set.actualReps = 5
        set.actualWeight = .kg(100)
        #expect(ExerciseHistoryRow.setText(set) == "5 @ 100 kg")
        set.rpe = 8
        #expect(ExerciseHistoryRow.setText(set) == "5 @ 100 kg · RPE 8")
    }
}
