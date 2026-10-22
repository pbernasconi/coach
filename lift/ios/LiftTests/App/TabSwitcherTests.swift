import Testing

@testable import Lift

/// Screens switch the shell's tab through `TabSwitching`; the Training launch openings go to Training.
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

    @Test func trainingOpeningsPushTheMadeUpActivitiesOrOpenTrends() {
        let ride = LaunchOptions(arguments: ["Lift", "-demo", "-tab", "training", "-open", "ride"])
        #expect(ride.opening?.tab == .training)
        #expect(ride.initialRoute(upcomingSessionID: nil) == .activity(DemoActivities.ride))
        #expect(ride.trainingSegment == .activities)
        let trends = LaunchOptions(arguments: ["Lift", "-demo", "-open", "trends"])
        #expect(trends.trainingSegment == .trends)
        #expect(trends.initialRoute(upcomingSessionID: nil) == nil)
        #expect(LaunchOptions(arguments: ["Lift", "-open", "trends"]).trainingSegment == .activities)
        #expect(LaunchOptions(arguments: ["Lift", "-demo", "-open", "activity-pending"]).opening == .activityPending)
    }
}
