import Foundation
import LiftCore
import Testing

@testable import LiftSync

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// The Week API client side (lift/WEEK-API.md): decoding, the request, the merge of kept responses and the cache.
@Suite struct CoachPlanTests {
    /// The example response of WEEK-API.md, cut to one day.
    static let contractJSON = """
        {
          "generatedAt": "2026-10-20T20:30:00.000Z",
          "timeZone": "America/Los_Angeles",
          "today": "2026-10-20",
          "weeks": [{
            "start": "2026-10-19", "title": "Build week 3", "hasPlan": true,
            "totals": { "plannedMinutes": 540, "plannedTss": 520, "doneMinutes": 130, "doneTss": 140,
                        "plannedCount": 9, "doneCount": 2, "missedCount": 0,
                        "text": "2/9 done · 2:10 of 9:00 · 140 of 520 TSS" },
            "days": [{ "date": "2026-10-20", "items": [{
              "id": "plan-1", "date": "2026-10-20", "startTime": "13:30", "endTime": "14:30",
              "title": "Heavy barbell lift", "sport": "strength", "workoutType": "strength-heavy",
              "intensity": "Heavy: 3 × 5 at 85%", "durationMinutes": 60, "tss": 45,
              "subtitle": "13:30 · 60 min · 45 TSS", "state": "today", "stateLabel": "Today", "compliance": null,
              "adapted": false, "why": "Strength keeps the legs durable for the ski block.",
              "notes": "Free text from the plan",
              "keyTargets": ["6 × 5:00 at 105–110% FTP"],
              "steps": [{ "label": "Warm up", "detail": "10:00 · 55–75% FTP" },
                        { "label": "6 ×", "detail": "5:00 at 105–110% FTP, 3:00 easy" }],
              "liftSessionId": "ca4f651b-98c7-4765-83a9-07ab74435d69",
              "done": { "source": "strava", "activityId": "16234567890", "name": "Morning Ride", "minutes": 62, "tss": 70,
                        "text": "62 min · 70 TSS / 60 min · 45 TSS" }
            }]}]
          }]
        }
        """

    static func plan(generatedAt: String, start: String, title: String) -> Data {
        let json = """
            {"generatedAt":"\(generatedAt)","timeZone":"UTC","today":"\(start)","weeks":[{"start":"\(start)",
            "title":"\(title)","hasPlan":true,"totals":{"text":"0/0","plannedCount":0,"doneCount":0,"missedCount":0},
            "days":[]}]}
            """
        return Data(json.utf8)
    }

    @Test func decodesTheContractExample() throws {
        let response = try CoachPlanResponse(data: Data(Self.contractJSON.utf8))
        let plan = response.plan
        #expect(plan.today == LocalDay(year: 2026, month: 10, day: 20))
        #expect(plan.generatedDate == Date(timeIntervalSince1970: 1_792_528_200))
        let week = try #require(plan.weeks.first)
        #expect(week.start == LocalDay(year: 2026, month: 10, day: 19))
        #expect(week.title == "Build week 3")
        #expect(week.totals.text == "2/9 done · 2:10 of 9:00 · 140 of 520 TSS")
        #expect(week.totals.plannedCount == 9)
        let item = try #require(week.days.first?.items.first)
        #expect(item.date == LocalDay(year: 2026, month: 10, day: 20))
        #expect(item.state == .today)
        #expect(item.stateLabel == "Today")
        #expect(item.compliance == nil)
        #expect(
            item.steps == [
                CoachStep(label: "Warm up", detail: "10:00 · 55–75% FTP"),
                CoachStep(label: "6 ×", detail: "5:00 at 105–110% FTP, 3:00 easy"),
            ]
        )
        #expect(item.keyTargets == ["6 × 5:00 at 105–110% FTP"])
        #expect(item.done?.name == "Morning Ride")
        #expect(item.done?.activityId == "16234567890")
        #expect(item.done?.text == "62 min · 70 TSS / 60 min · 45 TSS")
        #expect(item.durationMinutes == 60)
    }

    @Test func linksASessionIdInAnyCase() throws {
        let item = try CoachPlanResponse(data: Data(Self.contractJSON.utf8)).plan.weeks[0].days[0].items[0]
        let id = try #require(UUID(uuidString: "CA4F651B-98C7-4765-83A9-07AB74435D69"))
        #expect(item.links(id))
        #expect(!item.links(UUID(uuid: (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16))))
    }

    @Test func readsUnknownStatesAndMissingListsLeniently() throws {
        let json = """
            {"id":"x","date":"2026-10-21","title":"Spin","sport":"ride","subtitle":"","state":"paused",
            "stateLabel":"Paused","adapted":true,"liftSessionId":null}
            """
        let item = try JSONDecoder().decode(CoachItem.self, from: Data(json.utf8))
        #expect(item.state == .planned)
        #expect(item.steps.isEmpty && item.keyTargets.isEmpty)
        #expect(item.adapted)
    }

    @Test func refusesABodyThatIsNotTheContract() {
        #expect(throws: SyncTransportError.invalidResponse) {
            try CoachPlanResponse(data: Data(#"{"weeks":"no"}"#.utf8))
        }
        #expect(CoachPlanDates.day(fromPlain: "2026-1-5") == nil)
        #expect(CoachPlanDates.plain(LocalDay(year: 2026, month: 3, day: 5)) == "2026-03-05")
    }

    @Test func requestCarriesStartWeeksZoneAndToken() throws {
        let request = CoachPlanRequest.make(
            baseURL: try #require(URL(string: "https://coach.test")),
            start: LocalDay(year: 2026, month: 10, day: 19),
            weeks: 9,
            timeZone: "America/Los_Angeles",
            token: "secret"
        )
        #expect(
            request.url?.absoluteString
                == "https://coach.test/api/lift/week?start=2026-10-19&weeks=4&tz=America/Los_Angeles"
        )
        #expect(request.httpMethod == "GET")
        #expect(request.value(forHTTPHeaderField: "Authorization") == "Bearer secret")
    }

    @Test func clientSendsNothingWithoutAToken() async throws {
        let client = URLSessionCoachPlanClient(
            session: URLSession(configuration: .ephemeral),
            baseURL: try #require(URL(string: "https://coach.test")),
            tokens: StaticTokenProvider(nil)
        )
        await #expect(throws: SyncTransportError.missingToken) {
            try await client.weeks(from: LocalDay(year: 2026, month: 10, day: 19), count: 2, timeZone: "UTC")
        }
    }

    @Test func bookKeepsTheNewestResponseForEachWeek() throws {
        let older = try CoachPlanResponse(
            data: Self.plan(generatedAt: "2026-10-20T08:00:00Z", start: "2026-10-19", title: "Old")
        )
        let newer = try CoachPlanResponse(
            data: Self.plan(generatedAt: "2026-10-20T09:00:00.000Z", start: "2026-10-19", title: "New")
        )
        let start = LocalDay(year: 2026, month: 10, day: 19)
        #expect(CoachPlanBook([newer.plan, older.plan]).weeks[start]?.title == "New")
        #expect(CoachPlanBook([older.plan, newer.plan]).weeks[start]?.title == "New")
        #expect(CoachPlanBook([older.plan]).updatedAt == CoachPlanDates.date(fromISO: "2026-10-20T08:00:00Z"))
        #expect(CoachPlanBook([older.plan]).holds([start]))
        #expect(!CoachPlanBook([older.plan]).holds([start, start.adding(days: 7)]))
    }

    @Test func bookDatesEachWeekByItsOwnResponse() throws {
        let older = try CoachPlanResponse(
            data: Self.plan(generatedAt: "2026-10-20T08:00:00Z", start: "2026-10-19", title: "Old")
        )
        let newer = try CoachPlanResponse(
            data: Self.plan(generatedAt: "2026-10-21T09:00:00Z", start: "2026-10-26", title: "New")
        )
        let book = CoachPlanBook([older.plan, newer.plan])
        let first = LocalDay(year: 2026, month: 10, day: 19)
        #expect(book.updatedAt(of: first) == CoachPlanDates.date(fromISO: "2026-10-20T08:00:00Z"))
        #expect(book.updatedAt(of: first.adding(days: 7)) == CoachPlanDates.date(fromISO: "2026-10-21T09:00:00Z"))
        #expect(book.updatedAt(of: first.adding(days: 14)) == nil)
    }

    @Test func bookShowsAnItemTheNewerResponseMovedToAnotherWeekOnce() {
        let first = LocalDay(year: 2026, month: 10, day: 19)
        let second = first.adding(days: 7)
        func week(_ start: LocalDay, items: [CoachItem]) -> CoachWeek {
            let totals = CoachTotals(text: "", plannedCount: 0, doneCount: 0, missedCount: 0)
            let days = (0..<7).map { index in
                let day = start.adding(days: index)
                return CoachDay(date: day, items: items.filter { $0.date == day })
            }
            return CoachWeek(start: start, title: nil, hasPlan: true, totals: totals, days: days)
        }
        func item(_ day: LocalDay) -> CoachItem {
            CoachItem(
                id: "lift-1",
                date: day,
                title: "Lift",
                sport: "strength",
                subtitle: "",
                state: .planned,
                stateLabel: "Planned"
            )
        }
        let older = CoachPlan(
            generatedAt: "2026-10-20T08:00:00Z",
            timeZone: "UTC",
            today: first,
            weeks: [week(first, items: [item(first.adding(days: 1))]), week(second, items: [])]
        )
        let newer = CoachPlan(
            generatedAt: "2026-10-21T08:00:00Z",
            timeZone: "UTC",
            today: first,
            weeks: [week(second, items: [item(second)])]
        )
        for book in [CoachPlanBook([older, newer]), CoachPlanBook([newer, older])] {
            let ids = book.weeks.values.flatMap(\.days).flatMap(\.items).map(\.date)
            #expect(ids == [second])
        }
    }

    @Test func fileCacheSavesLoadsAndPrunes() throws {
        let folder = FileManager.default.temporaryDirectory.appending(path: "CoachPlanTests-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: folder) }
        let cache = FileCoachPlanCache(directory: folder)
        #expect(cache.load().isEmpty)
        let first = LocalDay(year: 2026, month: 10, day: 12)
        let second = LocalDay(year: 2026, month: 10, day: 19)
        try cache.save(Data("a".utf8), start: first)
        try cache.save(Data("b".utf8), start: second)
        try cache.save(Data("c".utf8), start: second)
        #expect(Set(cache.load()) == [Data("a".utf8), Data("c".utf8)])
        cache.prune(keeping: second...second.adding(days: 6))
        #expect(cache.load() == [Data("c".utf8)])
    }
}
