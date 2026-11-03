import Foundation
import Testing

@testable import Lift

/// Screens switch the shell's tab through `TabSwitching`; the activity launch openings go to Week.
@MainActor
@Suite struct TabSwitcherTests {
    @Test func aReTapOfTheSelectedTabAsksForItsRoot() {
        let tabs = TabSwitcher(selected: .week)
        tabs.barPicked(.today)
        #expect(tabs.selected == .today)
        #expect(tabs.rootRequests.isEmpty)
        tabs.barPicked(.today)
        tabs.barPicked(.today)
        #expect(tabs.rootRequests == [.today: 2])
        tabs.show(.today)
        #expect(tabs.rootRequests == [.today: 2])  // a switch from code is never a re-tap
    }

    @Test func showSelectsTheTab() {
        let tabs = TabSwitcher()
        #expect(tabs.selected == .week)  // Week is the home page
        tabs.show(.today)
        #expect(tabs.selected == .today)
    }

    @Test func activityOpeningsPushTheMadeUpActivitiesOnWeek() {
        let ride = LaunchOptions(arguments: ["Lift", "-demo", "-open", "ride"])
        #expect(ride.opening?.tab == .week)
        #expect(ride.initialTab == .week)
        #expect(ride.initialRoute(upcomingSessionID: nil) == .activity(DemoActivities.ride))
        #expect(LaunchOptions(arguments: ["Lift", "-demo", "-open", "trends"]).opening == nil)
        #expect(LaunchOptions(arguments: ["Lift", "-demo", "-open", "activity-pending"]).opening == .activityPending)
    }

    @Test func leaveGoesBackToTheTabBeforeOrTheFallback() {
        let tabs = TabSwitcher(selected: .coach)
        tabs.leave(.coach, fallback: .today)
        #expect(tabs.selected == .today)
        tabs.show(.week)
        tabs.show(.coach)
        tabs.leave(.coach, fallback: .today)
        #expect(tabs.selected == .week)
    }

    @Test func showsPushedPageFollowsTheSelectedTabsStack() {
        let tabs = TabSwitcher(selected: .week)
        #expect(!tabs.showsPushedPage)
        let workout = AppRoute.workout(UUID())
        tabs.stackChanged(.week, path: [workout])
        #expect(tabs.showsPushedPage)  // the Workout screen: no workout bar over it
        tabs.show(.lift)
        #expect(!tabs.showsPushedPage)  // Lift's root, the bar shows to go back
        tabs.show(.week)
        tabs.stackChanged(.week, path: [])
        #expect(!tabs.showsPushedPage)
    }
}
