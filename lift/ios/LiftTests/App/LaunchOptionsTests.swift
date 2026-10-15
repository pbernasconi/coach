import Foundation
import LiftCore
import Testing

@testable import Lift

/// The launch arguments CI and the UI smoke test pass.
@Suite struct LaunchOptionsTests {
    @Test(arguments: [
        ([], LaunchOptions()),
        (["Lift", "-demo"], LaunchOptions(isDemo: true)),
        (["Lift", "--demo"], LaunchOptions(isDemo: true)),
        (["Lift", "-tab", "history"], LaunchOptions(initialTab: .history)),
        (["Lift", "-demo", "-tab", "Exercises"], LaunchOptions(isDemo: true, initialTab: .exercises)),
        (["Lift", "-tab", "settings", "-appearance", "dark"], LaunchOptions(initialTab: .settings, appearance: .dark)),
        (["Lift", "-appearance", "light"], LaunchOptions(appearance: .light)),
        (["Lift", "-tab", "nope", "-appearance", "sepia"], LaunchOptions()),
        (["Lift", "-tab"], LaunchOptions()),
        (["Lift", "-demo", "-open", "workout"], LaunchOptions(isDemo: true, opening: .workout)),
        (["Lift", "-open", "Workout"], LaunchOptions(opening: .workout)),
        (["Lift", "-open", "nope"], LaunchOptions()),
        (["Lift", "-open"], LaunchOptions()),
        (["Lift", "-demo", "-tab", "exercises", "-open", "exercise"], LaunchOptions(isDemo: true, initialTab: .exercises, opening: .exercise)),
    ])
    func parsesArguments(arguments: [String], expected: LaunchOptions) {
        #expect(LaunchOptions(arguments: arguments) == expected)
    }

    @Test func openWorkoutInDemoModePushesTheUpcomingSession() {
        let id = UUID(uuid: (0, 0, 0, 0, 0, 0, 0x40, 0, 0x80, 0, 0, 0, 0, 0, 0, 7))
        let options = LaunchOptions(arguments: ["Lift", "-demo", "-open", "workout"])
        #expect(options.initialRoute(upcomingSessionID: id) == .workout(id))
        #expect(options.initialRoute(upcomingSessionID: nil) == nil)
    }

    @Test func openExerciseInDemoModePushesBackSquatOnExercises() {
        let options = LaunchOptions(arguments: ["Lift", "-demo", "-open", "exercise"])
        #expect(options.initialRoute(upcomingSessionID: nil) == .exercise(ExerciseLibrary.seedID(1)))
        #expect(options.opening?.tab == .exercises)
        #expect(LaunchOptions(opening: .exercise).initialRoute(upcomingSessionID: nil) == nil)
    }

    @Test func eachOpeningPushesOnItsTab() {
        #expect(LaunchOptions.Opening.workout.tab == .week)
        #expect(LaunchOptions.Opening.exercise.tab == .exercises)
    }

    @Test func openWorkoutNeedsDemoMode() {
        let id = UUID(uuid: (0, 0, 0, 0, 0, 0, 0x40, 0, 0x80, 0, 0, 0, 0, 0, 0, 7))
        #expect(LaunchOptions(opening: .workout).initialRoute(upcomingSessionID: id) == nil)
        #expect(LaunchOptions(isDemo: true).initialRoute(upcomingSessionID: id) == nil)
    }
}
