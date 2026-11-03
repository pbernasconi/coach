import Foundation
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// The planner's five steps: where it opens, Next and Back, which steps stay closed without a draft, the days' Free /
/// Off / Away, and Accept from Review (TEST-2). Made-up weeks only (TEST-8).
@MainActor
@Suite struct WeekPlannerStepsTests {
    let clock = ImmediateClock()

    func loaded(_ state: String = "proposed") async -> (WeekPlannerViewModel, FakeAppData) {
        let data = FakeAppData([.success(WeekPlannerViewModelTests.week(state))])
        data.putResult = .success(WeekPlannerViewModelTests.week())
        let vm = WeekPlannerViewModel(
            data: data,
            clock: clock,
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )
        await vm.run()
        return (vm, data)
    }

    /// The JSON body of the last write.
    func lastPut(_ data: FakeAppData) -> [String: Any] {
        guard let body = data.puts.last?.body else { return [:] }
        return (try? JSONSerialization.jsonObject(with: body)) as? [String: Any] ?? [:]
    }

    @Test func aDraftOpensOnTheDraftStep() async {
        let (vm, _) = await loaded()
        #expect(vm.state.step == .draft)

        let (none, _) = await loaded("none")
        #expect(none.state.step == .lastWeek)
        #expect(none.state.answers.away.isEmpty)  // the draft's own answers win over the suggestion
    }

    @Test func withoutADraftYourWeekStartsWithTheSuggestedAwayDays() async {
        let json = (String(bytes: WeekPlannerViewModelTests.week("none"), encoding: .utf8) ?? "")
            .replacingOccurrences(
                of:
                    #""answers": { "feel": "normal", "hours": 7, "gym": 2, "hard": null, "longDay": null, "daysOff": [], "away": [], "lock": "" }"#,
                with: #""answers": null"#
            )
        let data = FakeAppData([.success(Data(json.utf8))])
        let vm = WeekPlannerViewModel(
            data: data,
            clock: clock,
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )

        await vm.run()

        #expect(vm.state.answers.away == ["2026-03-13"])
        #expect(vm.state.answers.mode(of: "2026-03-13") == .away)
    }

    @Test func stepChangedNextTappedAndBackTappedMoveThroughTheSteps() async {
        let (vm, _) = await loaded()

        vm.send(.stepChanged(.lastWeek))
        #expect(vm.state.step == .lastWeek)
        vm.send(.nextTapped)
        #expect(vm.state.step == .days)
        vm.send(.nextTapped)
        #expect(vm.state.step == .shape)
        vm.send(.backTapped)
        #expect(vm.state.step == .days)
    }

    @Test func reviewAndDraftStayClosedWithoutADraft() async {
        let (vm, _) = await loaded("none")

        vm.send(.stepChanged(.review))
        #expect(vm.state.step == .lastWeek)
        vm.send(.stepChanged(.shape))
        vm.send(.nextTapped)
        #expect(vm.state.step == .shape)
    }

    @Test func dayModePickedKeepsADayInOneList() async {
        let (vm, _) = await loaded()

        vm.send(.dayModePicked("2026-03-13", .off))
        vm.send(.dayModePicked("2026-03-10", .off))
        #expect(vm.state.answers.daysOff == ["2026-03-10", "2026-03-13"])
        vm.send(.dayModePicked("2026-03-10", .away))
        #expect(vm.state.answers.daysOff == ["2026-03-13"])
        #expect(vm.state.answers.away == ["2026-03-10"])
        vm.send(.dayModePicked("2026-03-10", .free))
        #expect(vm.state.answers.away == [])
        #expect(vm.state.answers.mode(of: "2026-03-13") == .off)
    }

    @Test func acceptTappedOpensReviewOnlyForADraft() async {
        let (vm, _) = await loaded()
        vm.send(.acceptTapped)
        #expect(vm.state.step == .review)

        let (none, _) = await loaded("none")
        none.send(.acceptTapped)
        #expect(none.state.step == .lastWeek)
    }

    @Test func acceptTappedOnReviewAccepts() async {
        let (vm, data) = await loaded()
        vm.send(.acceptTapped)

        await vm.send(.acceptTapped)?.value

        #expect(lastPut(data)["action"] as? String == "accept")
    }

    @Test func pickingAWeekLoadsItOnStepOne() async {
        let data = FakeAppData([
            .success(WeekPlannerViewModelTests.week()),
            .success(WeekPlannerViewModelTests.week("none", monday: "2026-03-16")),
        ])
        let vm = WeekPlannerViewModel(
            data: data,
            clock: clock,
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )
        await vm.run()
        #expect(vm.state.step == .draft)

        await vm.send(.weekPicked("2026-03-16"))?.value

        #expect(data.fetched.last?.contains("week=2026-03-16") == true)
        #expect(vm.state.loaded?.weekStart == "2026-03-16")
        #expect(vm.state.step == .lastWeek)
        #expect(vm.send(.weekPicked("2026-03-16")) == nil)  // the shown week: nothing to load
    }

    @Test func writesNameTheShownWeek() async {
        let (vm, data) = await loaded()

        await vm.send(.undoTapped)?.value

        #expect(lastPut(data)["weekStart"] as? String == "2026-03-09")
    }
}
