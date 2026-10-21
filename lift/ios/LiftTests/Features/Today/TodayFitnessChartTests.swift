import Foundation
import LiftCore
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// The fitness chart's data is worked out once per body: dates, the measured and projected runs, the ranges, and the
/// nearest day for a touch.
@MainActor
@Suite struct TodayFitnessChartTests {
    let calendar = SessionBuilder.calendar

    func fitness() throws -> TodayFitness {
        try #require(
            try JSONDecoder().decode(AppToday.self, from: Data(AppAPISamples.todayContract.utf8)).fitness.value
        )
    }

    @Test func splitsMeasuredAndProjectedDaysWithDates() throws {
        let chart = TodayFitnessChart(try fitness(), calendar: calendar)
        let june22 = LocalDay(year: 2026, month: 6, day: 22).startDate(in: calendar)
        #expect(chart.days.map(\.date).first == june22)
        #expect(chart.measured.count == 1)
        #expect(chart.projected.map(\.projected) == [false, true])  // the last measured day, then the plan
        #expect(chart.events.map(\.label) == ["Haute Route"])
        #expect(chart.upperDomain.contains(67.6) && chart.upperDomain.contains(42.2) == false)
        #expect(chart.formDomain.contains(-6.8) && chart.formDomain.contains(4.8))
    }

    @Test func nearestFindsTheClosestDay() throws {
        let chart = TodayFitnessChart(try fitness(), calendar: calendar)
        let first = try #require(chart.days.first?.date)
        let last = try #require(chart.days.last?.date)
        #expect(chart.nearest(to: first.addingTimeInterval(-86_400)) == chart.days.first)
        #expect(chart.nearest(to: first.addingTimeInterval(3_600)) == chart.days.first)
        #expect(chart.nearest(to: last.addingTimeInterval(-3_600)) == chart.days.last)
        #expect(chart.nearest(to: last.addingTimeInterval(86_400 * 9)) == chart.days.last)
    }

    @Test func theViewModelWorksItOutOncePerBody() async throws {
        let body = Data(AppAPISamples.todayContract.utf8)
        let vm = TodayViewModel(
            data: FakeAppData([.success(body), .success(body)]),
            coachPlan: FakeCoachPlan([.off]),
            router: RecordingNavigator(),
            tabs: RecordingTabs(),
            now: SessionBuilder.now,
            calendar: calendar,
            anchor: nil
        )
        await vm.run()
        let chart = try #require(vm.state.fitness)
        #expect(chart == TodayFitnessChart(try fitness(), calendar: calendar))
        await vm.send(.refreshPulled)?.value
        #expect(vm.state.fitness == chart)
    }
}
