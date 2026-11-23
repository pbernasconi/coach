import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// The warm-up on the Workout screen: the checklist card, warm-up sets left out of the count, their short rest, and the
/// warm-up asked for once on a workout of today. Made-up sessions only (TEST-8); no sleeps (TEST-3).
@MainActor
@Suite struct WorkoutWarmUpTests {
    func makeViewModel(
        _ detail: SessionDetail,
        sessions: FakeSessionDetailRepository,
        router: RecordingNavigator = RecordingNavigator()
    ) -> WorkoutViewModel {
        WorkoutViewModel(
            sessionID: detail.id,
            sessions: sessions,
            sets: RecordingSetRepository(result: detail.items[0].sets[0]),
            templates: FakeTemplateRepository(),
            router: router,
            clock: ImmediateClock(),
            restActivity: RecordingRestActivityController(),
            catalog: FakeExerciseCatalog(),
            history: FakeExerciseHistoryRepository(emissions: [[]]),
            health: RecordingHealthRecorder(),
            gym: InMemoryGymSettings(.standard),
            preferences: InMemoryWorkoutSettings(),
            events: RecordingWorkoutEvents(),
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )
    }

    /// Today's planned session with its first set turned into a warm-up set, and the checklist in its note.
    private var withWarmUp: SessionDetail {
        var detail = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 3)
        detail.items[0].sets[0].kind = .warmUp
        detail.session.warmUpNote = WarmUpChecklist(items: ["Easy cardio · 5 min", "Dead bug · 5 / side"]).note
        return detail
    }

    @Test func theChecklistShowsAndWarmUpSetsAreNotCounted() async {
        let detail = withWarmUp
        let vm = makeViewModel(detail, sessions: FakeSessionDetailRepository(emissions: [detail]))
        await vm.run()

        guard case .loaded(let workout) = vm.state.workout else {
            Issue.record("not loaded")
            return
        }
        #expect(workout.warmUp?.items.map(\.text) == ["Easy cardio · 5 min", "Dead bug · 5 / side"])
        #expect(workout.warmUpNote == nil)
        #expect(workout.totalSets == 2)
        #expect(workout.exercises[0].sets.map(\.isWarmUp) == [true, false, false])
        #expect(vm.state.plannedSetsLeft == 2)
    }

    @Test func tickingAnItemSavesTheChecklist() async {
        let detail = withWarmUp
        let sessions = FakeSessionDetailRepository(emissions: [detail])
        let vm = makeViewModel(detail, sessions: sessions)
        await vm.run()

        await vm.send(.warmUpItemTapped(1))?.value

        let expected = WarmUpChecklist(note: detail.session.warmUpNote)?.toggling(1).note
        #expect(sessions.calls == [.saveWarmUpNote(detail.id, expected)])
    }

    @Test func aWarmUpSetRestsHalfAMinuteAtMost() {
        let detail = withWarmUp
        #expect(detail.restSeconds(afterLogging: detail.items[0].sets[0].id) == RestTimer.warmUpSeconds)
        #expect(detail.restSeconds(afterLogging: detail.items[0].sets[1].id) == RestTimer.defaultSeconds)
    }

    @Test func todaysWorkoutWithoutAWarmUpAsksForOneOnce() async {
        let detail = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 3)
        let sessions = FakeSessionDetailRepository(emissions: [detail, detail])
        let vm = makeViewModel(detail, sessions: sessions)
        await vm.run()

        #expect(sessions.warmUpsPlanned == [detail.id])
    }

    @Test func aWorkoutWithALoggedSetGetsNoWarmUp() async {
        let detail = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 1, planned: 2)
        let sessions = FakeSessionDetailRepository(emissions: [detail])
        let vm = makeViewModel(detail, sessions: sessions)
        await vm.run()

        #expect(sessions.warmUpsPlanned.isEmpty)
    }

    @Test func aPrepMoveOpensItsCatalogPage() async {
        let detail = withWarmUp
        let router = RecordingNavigator()
        let vm = makeViewModel(detail, sessions: FakeSessionDetailRepository(emissions: [detail]), router: router)
        await vm.run()

        await vm.send(.warmUpHowToTapped(catalogID: "0276"))?.value

        #expect(router.opened == [.catalogExercise("0276")])
    }
}
