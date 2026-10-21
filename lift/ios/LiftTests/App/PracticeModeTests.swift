import Foundation
import LiftCore
import LiftTesting
import Testing

@testable import Lift

/// Practice mode: the switch survives a relaunch, practice data never counts as the log, and leaving it ends the
/// workout Live Activity.
@MainActor
@Suite struct PracticeModeTests {
    private static let suite = "LiftTests.PracticeMode"

    private func freshDefaults() throws -> UserDefaults {
        let defaults = try #require(UserDefaults(suiteName: Self.suite))
        defaults.removePersistentDomain(forName: Self.suite)
        return defaults
    }

    @Test func practiceModeIsOffUntilTurnedOnAndKeptForTheNextLaunch() throws {
        let defaults = try freshDefaults()
        #expect(!UserDefaultsPracticeModeSettings(defaults: defaults).isOn)

        UserDefaultsPracticeModeSettings(defaults: defaults).isOn = true

        #expect(UserDefaultsPracticeModeSettings(defaults: defaults).isOn)
    }

    @Test func practiceDataIsSampleDataThatIsNeverSaved() {
        #expect(!AppInfo.DataSource.practice.isSaved)
        #expect(AppInfo.DataSource.practice.isSample && AppInfo.DataSource.demo.isSample)
        #expect(!AppInfo.DataSource.device.isSample && !AppInfo.DataSource.fresh.isSample)
    }

    @Test func stoppingEndsTheLiveActivityAndForgetsTheWorkout() async {
        let started = SessionBuilder.session(id: 1, on: Fixtures.monday, done: 1, planned: 2)
        let presenter = RecordingWorkoutActivityPresenter()
        let center = WorkoutActivityCenter(
            sessions: FakeSessionDetailRepository(emissions: [started]),
            sets: RecordingSetRepository(result: started.items[0].sets[0]),
            presenter: presenter,
            gym: InMemoryGymSettings(.standard),
            calendar: SessionBuilder.calendar,
            now: { ManualNow.start }
        )
        center.showWorkout(started.id)
        await center.settle()

        await center.stop()

        #expect(presenter.calls.last == .end)
        #expect(center.sessionID == nil)
    }
}
