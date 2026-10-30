import Foundation
import LiftSync
import Testing

@testable import Lift

/// The Today hero reads fitness, form and fatigue and the chart's window from the Today page's fitness section.
@Suite struct TodayFitnessSummaryTests {
    private let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        return calendar
    }()

    private func fitness(_ json: String) throws -> TodayFitness {
        try JSONDecoder().decode(TodayFitness.self, from: Data(json.utf8))
    }

    @Test func roundsTheNumbersAndMeasuresTheWeek() throws {
        let section = try fitness(
            """
            {"today": "2026-10-30", "zones": [], "events": [], "caption": null,
             "now": {"date": "2026-10-30", "ctl": 66.6, "atl": 47.2, "tsb": 19.4, "zone": "Fresh"},
             "days": [
               {"date": "2026-09-01", "ctl": 50, "atl": 50, "tsb": 0, "projected": false},
               {"date": "2026-10-23", "ctl": 63.8, "atl": 60, "tsb": 3.8, "projected": false},
               {"date": "2026-10-30", "ctl": 66.6, "atl": 47.2, "tsb": 19.4, "projected": false},
               {"date": "2026-11-02", "ctl": 68, "atl": 52, "tsb": 16, "projected": true}]}
            """
        )
        let summary = try #require(TodayFitnessSummary(section, calendar: calendar))
        #expect(summary.fitness == 67)
        #expect(summary.form == 19)
        #expect(summary.fatigue == 47)
        #expect(summary.zone == "Fresh")
        #expect(summary.fitnessChange == 3)
        #expect(summary.changeText == "+3 this week")
        // September 1 is more than six weeks back.
        #expect(summary.points.count == 3)
        #expect(summary.points.last?.projected == true)
    }

    @Test func noActualDayMeansNoHero() throws {
        let section = try fitness(#"{"today": "2026-10-30", "zones": [], "events": [], "days": [], "now": null}"#)
        #expect(TodayFitnessSummary(section, calendar: calendar) == nil)
    }

    @Test func negativeNumbersGetATrueMinusSign() {
        #expect(TodayFitnessSummary.text(-4) == "\u{2212}4")
    }
}
