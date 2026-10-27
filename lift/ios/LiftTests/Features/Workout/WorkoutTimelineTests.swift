import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// The workout timeline (`WorkoutViewModel+Timeline`): each moment of a workout is recorded with its time and the set it
/// is about. Made-up sessions only (TEST-8); no sleeps, no real time (TEST-3).
@MainActor
@Suite struct WorkoutTimelineTests {
    let planned = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 0, planned: 3)
    let events = RecordingWorkoutEvents()

    func makeViewModel(_ detail: SessionDetail) -> WorkoutViewModel {
        WorkoutViewModel(
            sessionID: detail.id,
            sessions: FakeSessionDetailRepository(emissions: [detail]),
            sets: RecordingSetRepository(result: detail.items[0].sets[0]),
            templates: FakeTemplateRepository(),
            router: RecordingNavigator(),
            clock: ImmediateClock(),
            restActivity: RecordingRestActivityController(),
            catalog: FakeExerciseCatalog(),
            history: FakeExerciseHistoryRepository(emissions: [[]]),
            health: RecordingHealthRecorder(),
            gym: InMemoryGymSettings(.standard),
            preferences: InMemoryWorkoutSettings(),
            events: events,
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )
    }

    @Test func loggingASetRecordsItAndTheRestItStarts() async {
        let vm = makeViewModel(planned)
        await vm.run()
        let first = planned.items[0].sets[0].id

        await vm.send(.setLogTapped(first))?.value
        await vm.timelineSettled()

        let logged = events.recorded.filter { $0.kind == .setLogged || $0.kind == .restStarted }
        #expect(logged.map(\.kind) == [.setLogged, .restStarted])
        #expect(logged.allSatisfy { $0.setID == first && $0.sessionID == planned.id && $0.source == .app })
        #expect(logged.last?.seconds == RestTimer.defaultSeconds)
        #expect(logged.first?.occurredAt == SessionBuilder.now())
    }

    @Test func skippingTheRestRecordsHowLongItRan() async {
        let vm = makeViewModel(planned)
        await vm.run()
        let first = planned.items[0].sets[0].id
        await vm.send(.setLogTapped(first))?.value

        vm.send(.restSkipTapped)
        await vm.timelineSettled()

        let skipped = events.recorded.last
        #expect(skipped?.kind == .restSkipped)
        #expect(skipped?.setID == first)
        #expect(skipped?.seconds == 0)
    }

    @Test func skipAndStartTapsRecordTheirMoments() async {
        let vm = makeViewModel(planned)
        await vm.run()
        let set = planned.items[0].sets[1].id

        vm.send(.setSkipTapped(set))
        vm.send(.exerciseStartTapped(setID: set))
        await vm.timelineSettled()

        #expect(events.kinds == [.setSkipped, .exerciseStarted])
        #expect(events.recorded.map(\.setID) == [set, set])
    }
}
