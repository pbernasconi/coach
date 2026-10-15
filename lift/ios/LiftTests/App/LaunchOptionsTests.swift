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
    ])
    func parsesArguments(arguments: [String], expected: LaunchOptions) {
        #expect(LaunchOptions(arguments: arguments) == expected)
    }
}
