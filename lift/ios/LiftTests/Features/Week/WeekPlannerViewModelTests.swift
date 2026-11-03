import Foundation
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// One test per Action of the planning screen, and its load and polling (TEST-2). Writes are awaited through
/// `send(...)?.value`; the clock is immediate, so polling takes no real time (TEST-3). Made-up weeks only (TEST-8).
@MainActor
@Suite struct WeekPlannerViewModelTests {
    let clock = ImmediateClock()

    /// A made-up planning week: one day with one session that has one free slot.
    static func week(_ state: String = "proposed", refused: String? = nil, note: String? = nil) -> Data {
        let session = #"""
            { "index": 4, "title": "Long run", "sport": "run", "minutes": 90, "timeText": "8:00", "lengthText": "1h30",
              "tssText": "80 TSS", "hard": false, "why": "Long day", "description": null, "changed": false,
              "slots": [{ "date": "2026-03-15", "time": "09:00", "text": "Sun 9:00" }] }
            """#
        let extra = [refused.map { #""refusedText": "\#($0)""# }, note.map { #""note": "\#($0)""# }]
            .compactMap(\.self).map { ", \($0)" }.joined()
        let json = #"""
            { "weekStart": "2026-03-09", "titleText": "Plan Mar 9–15", "weekText": "Mar 9–15", "state": "\#(state)",
              "proposalId": "p1", "version": 2, "errorText": null, "totalsText": "1h30", "checks": null,
              "days": [{ "date": "2026-03-14", "labelText": "Sat 14", "past": false, "freeText": "Free 6:00–21:00",
                         "off": false, "totalText": "1h30",
                         "sessions": [\#(state == "proposed" ? session : "")], "calendar": [] }],
              "change": null, "review": null, "summary": null, "issues": [], "quickAsks": ["Make it lighter"],
              "lastWeek": null, "facts": [], "feels": [{ "id": "fresh", "label": "Fresh" }],
              "suggested": { "feelText": null, "hours": 8, "hoursText": null },
              "answers": { "feel": "normal", "hours": 7, "gym": 2, "hard": null, "longDay": null, "daysOff": [], "away": [], "lock": "" },
              "longDays": [], "planningAround": [], "syncsTo": ["Google Calendar"],
              "versusTitle": "Against last week", "versus": [], "keepers": []\#(extra) }
            """#
        return Data(json.utf8)
    }

    func loaded(_ state: String = "proposed") async -> (WeekPlannerViewModel, FakeAppData) {
        let data = FakeAppData([.success(Self.week(state))])
        data.putResult = .success(Self.week())
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

    @Test func runLoadsTheWeekAndItsAnswers() async {
        let (vm, data) = await loaded()

        #expect(data.fetched == ["api/app/plan/week"])
        #expect(vm.state.isProposed)
        #expect(vm.state.answers.hours == 7)
        #expect(clock.sleepCount == 0)
    }

    @Test func runPollsWhileCoachDrafts() async {
        let data = FakeAppData([.success(Self.week("drafting")), .success(Self.week())])
        let vm = WeekPlannerViewModel(
            data: data,
            clock: clock,
            now: SessionBuilder.now,
            calendar: SessionBuilder.calendar
        )

        await vm.run()

        #expect(clock.sleepCount == 1)
        #expect(vm.state.isProposed)
    }

    @Test func aDraftOpensOnTheDraftStep() async {
        let (vm, _) = await loaded()
        #expect(vm.state.step == .draft)

        let (none, _) = await loaded("none")
        #expect(none.state.step == .lastWeek)
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

    @Test func retryTappedAndRefreshPulledFetchAgain() async {
        let (vm, data) = await loaded()

        await vm.send(.retryTapped)?.value
        await vm.send(.refreshPulled)?.value

        #expect(data.fetched.count == 3)
    }

    @Test func feelTappedPicksAndClears() async {
        let (vm, _) = await loaded()

        vm.send(.feelTapped("fresh"))
        #expect(vm.state.answers.feel == "fresh")
        vm.send(.feelTapped("fresh"))
        #expect(vm.state.answers.feel == nil)
    }

    @Test func shapeAnswersAreKept() async {
        let (vm, _) = await loaded()

        vm.send(.hoursChanged(9))
        vm.send(.liftsPicked(3))
        vm.send(.hardPicked(nil))
        vm.send(.longDayPicked("2026-03-15"))
        vm.send(.anythingChanged("Away Friday"))

        #expect(vm.state.answers.hours == 9)
        #expect(vm.state.answers.gym == 3)
        #expect(vm.state.answers.hard == nil)
        #expect(vm.state.answers.longDay == "2026-03-15")
        #expect(vm.state.answers.lock == "Away Friday")
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

    @Test func draftTappedSendsTheAnswersAndShowsTheWeek() async {
        let (vm, data) = await loaded()
        vm.send(.stepChanged(.shape))
        vm.send(.hoursChanged(10))

        await vm.send(.draftTapped)?.value

        let body = lastPut(data)
        #expect(data.puts.last?.path == "api/app/plan/week")
        #expect(body["action"] as? String == "draft")
        #expect((body["answers"] as? [String: Any])?["hours"] as? Int == 10)
        #expect(vm.state.step == .draft)
        #expect(vm.state.write == .idle)
    }

    @Test func noteSentRevisesAndClearsTheBox() async {
        let (vm, data) = await loaded()
        vm.send(.noteChanged("  Lighter please "))

        await vm.send(.noteSent)?.value

        #expect(lastPut(data)["note"] as? String == "Lighter please")
        #expect(lastPut(data)["proposalId"] as? String == "p1")
        #expect(vm.state.note.isEmpty)
    }

    @Test func noteSentWithAnEmptyBoxSendsNothing() async {
        let (vm, data) = await loaded()
        vm.send(.noteChanged("   "))

        #expect(vm.send(.noteSent) == nil)
        #expect(data.puts.isEmpty)
    }

    @Test func quickAskTappedRevises() async {
        let (vm, data) = await loaded()

        await vm.send(.quickAskTapped("Make it lighter"))?.value

        #expect(lastPut(data)["action"] as? String == "revise")
        #expect(lastPut(data)["note"] as? String == "Make it lighter")
    }

    @Test func undoTappedUndoes() async {
        let (vm, data) = await loaded()

        await vm.send(.undoTapped)?.value

        #expect(lastPut(data)["action"] as? String == "undo")
    }

    @Test func acceptTappedOpensReviewOnlyForADraft() async {
        let (vm, _) = await loaded()
        vm.send(.acceptTapped)
        #expect(vm.state.step == .review)

        let (none, _) = await loaded("none")
        none.send(.acceptTapped)
        #expect(none.state.step == .lastWeek)
    }

    @Test func acceptConfirmedClosesWithTheCoachsLine() async {
        let (vm, data) = await loaded()
        data.putResult = .success(Self.week(note: "On your calendar now"))
        vm.send(.acceptTapped)

        await vm.send(.acceptConfirmed)?.value

        #expect(lastPut(data)["action"] as? String == "accept")
        #expect(vm.state.acceptedNote == "On your calendar now")
        #expect(vm.state.destination == nil)
    }

    @Test func acceptTappedOnReviewAccepts() async {
        let (vm, data) = await loaded()
        vm.send(.acceptTapped)

        await vm.send(.acceptTapped)?.value

        #expect(lastPut(data)["action"] as? String == "accept")
    }

    @Test func aRefusedChangeSaysWhy() async {
        let (vm, data) = await loaded()
        data.putResult = .success(Self.week(refused: "Coach is already drafting this week."))

        await vm.send(.undoTapped)?.value

        #expect(vm.state.failureText == "Coach is already drafting this week.")
    }

    @Test func aFailedWriteSaysSo() async {
        let (vm, data) = await loaded()
        data.putResult = .failure(.retryable(status: 500))

        await vm.send(.undoTapped)?.value

        #expect(vm.state.failureText != nil)
        #expect(!vm.state.isWorking)
    }
}

/// The session sheet: open, move, length, remove and swap.
extension WeekPlannerViewModelTests {
    @Test func sessionTappedOpensItsSheetAndDismissCloses() async {
        let (vm, _) = await loaded()

        vm.send(.sessionTapped(4))
        #expect(vm.state.openSession?.title == "Long run")
        vm.send(.destinationDismissed)
        #expect(vm.state.destination == nil)
    }

    @Test func slotPickedMovesAndClosesTheSheet() async throws {
        let (vm, data) = await loaded()
        vm.send(.sessionTapped(4))
        let slot = try #require(vm.state.openSession?.slots.first)

        await vm.send(.slotPicked(slot))?.value

        let op = lastPut(data)["op"] as? [String: Any]
        #expect(op?["kind"] as? String == "move")
        #expect(op?["date"] as? String == "2026-03-15")
        #expect(op?["time"] as? String == "09:00")
        #expect(vm.state.destination == nil)
    }

    @Test func lengthChangedKeepsTheSheetOpen() async {
        let (vm, data) = await loaded()
        vm.send(.sessionTapped(4))

        await vm.send(.lengthChanged(105))?.value

        let op = lastPut(data)["op"] as? [String: Any]
        #expect(op?["kind"] as? String == "length")
        #expect(op?["minutes"] as? Int == 105)
        #expect(vm.state.destination == .session(4))
    }

    @Test func removeTappedRemovesAndClosesTheSheet() async {
        let (vm, data) = await loaded()
        vm.send(.sessionTapped(4))

        await vm.send(.removeTapped)?.value

        #expect((lastPut(data)["op"] as? [String: Any])?["kind"] as? String == "remove")
        #expect(vm.state.destination == nil)
    }

    @Test func swapTappedAsksCoach() async {
        let (vm, data) = await loaded()
        vm.send(.sessionTapped(4))

        await vm.send(.swapTapped)?.value

        #expect(lastPut(data)["action"] as? String == "revise")
        #expect((lastPut(data)["note"] as? String)?.contains("Long run") == true)
    }
}
