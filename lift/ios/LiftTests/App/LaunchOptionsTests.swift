import Foundation
import LiftCore
import LiftTesting
import Testing

@testable import Lift

/// The launch arguments CI and the UI smoke test pass.
@Suite struct LaunchOptionsTests {
    @Test(arguments: [
        ([], LaunchOptions()),
        (["Lift", "-demo"], LaunchOptions(isDemo: true)),
        (["Lift", "--demo"], LaunchOptions(isDemo: true)),
        (["Lift", "-fresh"], LaunchOptions(isFresh: true)),
        (["Lift", "-demo", "-fresh", "-tab", "history"], LaunchOptions(initialTab: .history, isFresh: true)),
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
        (
            ["Lift", "-demo", "-tab", "history", "-open", "import"],
            LaunchOptions(isDemo: true, initialTab: .history, opening: .importNotes)
        ),
        (
            ["Lift", "-demo", "-tab", "exercises", "-open", "exercise"],
            LaunchOptions(isDemo: true, initialTab: .exercises, opening: .exercise)
        ),
    ])
    func parsesArguments(arguments: [String], expected: LaunchOptions) {
        #expect(LaunchOptions(arguments: arguments) == expected)
    }

    @Test func eachLaunchNamesWhereItsDataLives() {
        #expect(LaunchOptions().dataSource == .device)
        #expect(LaunchOptions(isDemo: true).dataSource == .demo)
        #expect(LaunchOptions(arguments: ["Lift", "-demo", "-fresh"]).dataSource == .fresh)
        #expect(
            !AppInfo.DataSource.fresh.isSaved && !AppInfo.DataSource.demo.isSaved && AppInfo.DataSource.device.isSaved
        )
        #expect(
            LaunchOptions(arguments: ["Lift", "-fresh", "-open", "workout"]).initialRoute(upcomingSessionID: nil) == nil
        )
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
        #expect(LaunchOptions.Opening.importNotes.tab == .history)
        #expect(LaunchOptions.Opening.catalog.tab == .exercises)
    }

    @Test func openCatalogInDemoModePushesTheBrowseOnExercises() {
        let options = LaunchOptions(arguments: ["Lift", "-demo", "-tab", "exercises", "-open", "catalog"])
        #expect(options.opening == .catalog)
        #expect(options.initialRoute(upcomingSessionID: nil) == .catalog)
        #expect(LaunchOptions(opening: .catalog).initialRoute(upcomingSessionID: nil) == nil)
    }

    @Test func openImportInDemoModeOpensTheSampleNotARoute() {
        let options = LaunchOptions(arguments: ["Lift", "-demo", "-tab", "history", "-open", "import"])
        #expect(options.opensImportSample)
        #expect(options.initialRoute(upcomingSessionID: nil) == nil)
        #expect(!LaunchOptions(opening: .importNotes).opensImportSample)
        #expect(!LaunchOptions(isDemo: true, opening: .workout).opensImportSample)
    }

    @Test func openWorkoutNeedsDemoMode() {
        let id = UUID(uuid: (0, 0, 0, 0, 0, 0, 0x40, 0, 0x80, 0, 0, 0, 0, 0, 0, 7))
        #expect(LaunchOptions(opening: .workout).initialRoute(upcomingSessionID: id) == nil)
        #expect(LaunchOptions(isDemo: true).initialRoute(upcomingSessionID: id) == nil)
    }

    @Test func planningOpeningsPushTheirScreens() {
        let templateID = IDSequence.id(1, prefix: 0xD1)
        let sessionID = IDSequence.id(1, prefix: 0xA0)
        #expect(
            LaunchOptions(arguments: ["-demo", "-open", "templates"]).initialRoute(upcomingSessionID: nil) == .templates
        )
        let template = LaunchOptions(arguments: ["-demo", "-open", "template"])
        #expect(template.initialRoute(upcomingSessionID: nil, templateID: templateID) == .template(templateID))
        let summary = LaunchOptions(arguments: ["-demo", "-open", "summary"])
        #expect(summary.initialRoute(upcomingSessionID: nil, loggedSessionID: sessionID) == .workoutSummary(sessionID))
        #expect(LaunchOptions(opening: .templates).initialRoute(upcomingSessionID: nil) == nil)
        #expect(LaunchOptions.Opening.templates.tab == .exercises)
        #expect(LaunchOptions.Opening.template.tab == .exercises)
        #expect(LaunchOptions.Opening.summary.tab == .week)
    }

    @Test func openURLKeepsALiftLinkAsWritten() throws {
        let options = LaunchOptions(arguments: ["Lift", "-open-url", "lift://sync?code=AbC123"])
        #expect(options.openURL == URL(string: "lift://sync?code=AbC123"))
        #expect(LaunchOptions(arguments: ["Lift", "-open-url", "https://example.com"]).openURL == nil)
        #expect(LaunchOptions(arguments: ["Lift", "-open-url"]).openURL == nil)
    }
}
