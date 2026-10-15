import Foundation
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

    @Test func openWorkoutNeedsDemoMode() {
        let id = UUID(uuid: (0, 0, 0, 0, 0, 0, 0x40, 0, 0x80, 0, 0, 0, 0, 0, 0, 7))
        #expect(LaunchOptions(opening: .workout).initialRoute(upcomingSessionID: id) == nil)
        #expect(LaunchOptions(isDemo: true).initialRoute(upcomingSessionID: id) == nil)
    }
}
