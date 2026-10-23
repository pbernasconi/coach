import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// The workout Live Activity: what `WorkoutActivityCenter` shows as the workout changes, and what its Done, Next, +30s
/// and Skip buttons do. A recording presenter, a fake store and a manual wall clock (TEST-3); made-up sessions only
/// (TEST-8).
@MainActor
@Suite struct WorkoutActivityCenterTests {
    let started = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 1, planned: 2)
    let presenter = RecordingWorkoutActivityPresenter()
    let now = ManualNow()

    var sets: [SetRecord] { started.items[0].sets }

    var finished: SessionDetail {
        var detail = started
        detail.session.finishedAt = ManualNow.start
        return detail
    }

    func makeCenter(
        _ emissions: [SessionDetail?],
        sets: RecordingSetRepository? = nil,
        sessions: FakeSessionDetailRepository? = nil,
        preferences: WorkoutPreferences = WorkoutPreferences(),
        restAlerts: any RestAlerting = NoRestAlerts()
    ) -> WorkoutActivityCenter {
        WorkoutActivityCenter(
            sessions: sessions ?? FakeSessionDetailRepository(emissions: emissions),
            sets: sets ?? RecordingSetRepository(result: started.items[0].sets[0]),
            presenter: presenter,
            gym: InMemoryGymSettings(.standard),
            preferences: InMemoryWorkoutSettings(preferences),
            restAlerts: restAlerts,
            calendar: SessionBuilder.calendar,
            now: { [now] in now() }
        )
    }

    /// A center showing `started`.
    func showing(sets: RecordingSetRepository? = nil) async -> WorkoutActivityCenter {
        let center = makeCenter([started], sets: sets)
        center.showWorkout(started.id)
        await center.settle()
        return center
    }

    @Test func aStartedWorkoutShowsTheSetAfterTheLoggedOne() async {
        _ = await showing()

        let expected = WorkoutActivityAttributes.ContentState(
            current: WorkoutActivitySet(
                id: sets[1].id,
                exerciseName: "Back squat",
                title: "Set 2",
                weight: "100",
                unit: "kg",
                reps: "5"
            ),
            exerciseNumber: 1,
            exerciseCount: 1,
            dots: [.done, .current, .planned],
            loggedSets: 1,
            totalSets: 3,
            rest: nil,
            nextExercise: nil
        )
        #expect(
            presenter.calls == [.show(WorkoutActivityAttributes(sessionID: started.id, title: "Lower A"), expected)]
        )
    }

    @Test func aWorkoutNotStartedShowsNothing() async {
        let planned = SessionBuilder.session(id: 2, on: Fixtures.monday, done: 0, planned: 3)
        let center = makeCenter([planned])

        center.showWorkout(planned.id)
        await center.settle()

        #expect(presenter.calls.isEmpty)
    }

    @Test func finishingTheWorkoutEndsTheActivity() async {
        let center = makeCenter([started, finished])

        center.showWorkout(started.id)
        await center.settle()

        #expect(presenter.calls.count == 2)
        #expect(presenter.calls.last == .end)
    }

    @Test func discardingTheWorkoutEndsTheActivity() async {
        let center = makeCenter([started, nil])

        center.showWorkout(started.id)
        await center.settle()

        #expect(presenter.calls.last == .end)
    }

    @Test func doneLogsTheSetAndStartsItsRest() async {
        let recorder = RecordingSetRepository(result: started.items[0].sets[1])
        let center = await showing(sets: recorder)

        await center.logSet(sets[1].id, in: started.id)

        #expect(recorder.calls == [.log(sets[1].id)])
        let rest = RestSnapshot(endsAt: ManualNow.start.addingTimeInterval(90), totalSeconds: 90, setID: sets[1].id)
        #expect(presenter.shown?.rest == rest)
        #expect(center.currentRest() == rest)
    }

    @Test func theButtonsActOnTheSetShown() async {
        let recorder = RecordingSetRepository(result: started.items[0].sets[1])
        let center = await showing(sets: recorder)

        await center.showNextSet()
        #expect(presenter.shown?.current?.id == sets[2].id)

        await center.logShownSet()
        #expect(recorder.calls == [.log(sets[2].id)])
    }

    @Test func doneOnASetLoggedMeanwhileDoesNothing() async {
        let recorder = RecordingSetRepository(result: started.items[0].sets[0])
        let center = await showing(sets: recorder)

        await center.logSet(sets[0].id, in: started.id)

        #expect(recorder.calls.isEmpty)
        #expect(presenter.shown?.rest == nil)
    }

    @Test func doneAfterARelaunchLoadsTheWorkoutFirst() async {
        let recorder = RecordingSetRepository(result: started.items[0].sets[1])
        let center = makeCenter([started], sets: recorder)

        await center.logSet(sets[1].id, in: started.id)

        #expect(center.sessionID == started.id)
        #expect(recorder.calls == [.log(sets[1].id)])
        #expect(presenter.shown?.rest?.totalSeconds == 90)
    }

    @Test func nextShowsTheFollowingPlannedSetWithoutLogging() async {
        let recorder = RecordingSetRepository(result: started.items[0].sets[0])
        let center = await showing(sets: recorder)

        await center.showNextSet(after: sets[1].id, in: started.id)
        #expect(presenter.shown?.current?.id == sets[2].id)
        #expect(presenter.shown?.dots == [.done, .planned, .current])

        await center.showNextSet(after: sets[2].id, in: started.id)
        #expect(presenter.shown?.current?.id == sets[1].id)
        #expect(recorder.calls.isEmpty)
    }

    @Test func aRestFromTheWorkoutScreenShowsOnTheLockScreen() async {
        let center = await showing()
        let state = RestActivityAttributes.ContentState(
            endsAt: ManualNow.start.addingTimeInterval(120),
            totalSeconds: 120,
            nextSetLabel: nil
        )

        center.start(RestActivityAttributes(exerciseName: "Back squat", setLabel: "Set 1"), state: state)
        await center.settle()

        #expect(
            presenter.shown?.rest == RestSnapshot(endsAt: ManualNow.start.addingTimeInterval(120), totalSeconds: 120)
        )
    }

    @Test func endingTheRestKeepsTheWorkout() async {
        let center = await showing()
        await center.logSet(sets[1].id, in: started.id)

        center.end()
        await center.settle()

        #expect(presenter.shown?.rest == nil)
        #expect(presenter.shown?.current != nil)
    }

    @Test func addTimeExtendsTheRest() async {
        let center = await showing()
        await center.logSet(sets[1].id, in: started.id)
        now.advance(seconds: 10)

        await center.extendRest()

        #expect(center.currentRest()?.endsAt == ManualNow.start.addingTimeInterval(120))
        #expect(center.currentRest()?.setID == sets[1].id)
        #expect(presenter.shown?.rest?.totalSeconds == 120)
    }

    @Test func addTimeAfterTheRestIsOverDoesNothing() async {
        let center = await showing()
        await center.logSet(sets[1].id, in: started.id)
        now.advance(seconds: 95)

        await center.extendRest()

        #expect(center.currentRest()?.totalSeconds == 90)
    }

    @Test func skipEndsTheRestAndKeepsTheWorkout() async {
        let center = await showing()
        await center.logSet(sets[1].id, in: started.id)

        await center.skipRest()

        #expect(center.currentRest() == nil)
        #expect(presenter.shown?.rest == nil)
        #expect(presenter.shown?.current != nil)
    }

    @Test func resumePicksUpTheActivityAndItsRest() async {
        let rest = RestSnapshot(endsAt: ManualNow.start.addingTimeInterval(60), totalSeconds: 90)
        var state = WorkoutActivityAttributes.ContentState(
            overview: WorkoutOverview(
                detail: started,
                days: DayCalendar(calendar: SessionBuilder.calendar),
                previous: [:],
                gym: .standard
            ),
            currentSetID: sets[1].id,
            rest: nil
        )
        state.rest = rest
        presenter.leftRunning = (WorkoutActivityAttributes(sessionID: started.id, title: "Lower A"), state)
        let center = makeCenter([started])

        center.resume()
        await center.settle()

        #expect(center.sessionID == started.id)
        #expect(center.currentRest() == rest)
        #expect(presenter.shown == state)
    }

    @Test func resumeEndsTheActivityOfAFinishedWorkout() async {
        presenter.leftRunning = (
            WorkoutActivityAttributes(sessionID: started.id, title: "Lower A"),
            WorkoutActivityAttributes.ContentState(
                current: nil,
                exerciseNumber: 1,
                exerciseCount: 1,
                dots: [],
                loggedSets: 3,
                totalSets: 3,
                rest: nil,
                nextExercise: nil
            )
        )
        let center = makeCenter([finished])

        center.resume()
        await center.settle()

        #expect(presenter.calls == [.end])
    }

    // MARK: Workout settings and pausing

    @Test func turnedOffInWorkoutSettingsItShowsNothing() async {
        let center = makeCenter([started], preferences: WorkoutPreferences.with { $0.showsLiveActivity = false })

        center.showWorkout(started.id)
        await center.settle()

        #expect(presenter.calls.isEmpty)
    }

    @Test func doneUsesTheDefaultRestForAnExerciseWithoutOne() async {
        var detail = started
        detail.items[0].exercise.restSeconds = nil
        let center = makeCenter([detail], preferences: WorkoutPreferences.with { $0.defaultRestSeconds = 150 })
        center.showWorkout(detail.id)
        await center.settle()

        await center.logSet(sets[1].id, in: detail.id)

        #expect(center.currentRest()?.totalSeconds == 150)
    }

    @Test func doneStartsNoRestWhenWorkoutSettingsTurnItOff() async {
        let center = makeCenter([started], preferences: WorkoutPreferences.with { $0.startsRest = false })
        center.showWorkout(started.id)
        await center.settle()

        await center.logSet(sets[1].id, in: started.id)

        #expect(center.currentRest() == nil)
    }

    @Test func doneOnAPausedWorkoutResumesItFirst() async {
        var paused = started
        paused.session.pausedAt = ManualNow.start
        let sessions = FakeSessionDetailRepository(emissions: [paused])
        let center = makeCenter([paused], sessions: sessions)
        center.showWorkout(paused.id)
        await center.settle()
        #expect(presenter.shown?.pausedAt == ManualNow.start)

        await center.logSet(sets[1].id, in: paused.id)

        #expect(sessions.calls == [.changeTime(paused.id, .resume)])
    }

    @Test func everyRestChangeReachesTheRestAlert() async {
        let alerts = RecordingRestAlerts()
        let center = makeCenter([started], restAlerts: alerts)
        center.showWorkout(started.id)
        await center.settle()

        await center.logSet(sets[1].id, in: started.id)
        await center.skipRest()

        let end = ManualNow.start.addingTimeInterval(90)
        #expect(alerts.ends.contains(end))
        #expect(alerts.ends.last == .some(nil))
    }
}

/// Records each rest end `WorkoutActivityCenter` reports.
final class RecordingRestAlerts: RestAlerting {
    private(set) var ends: [Date?] = []

    func restChanged(endsAt: Date?, nextSet _: String?) {
        ends.append(endsAt)
    }
}
