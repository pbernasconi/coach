import Foundation
import LiftSync
import LiftTesting
import Testing

@testable import Lift

/// `GET /api/app/lift` decodes as the contract writes it, section by section (lift/APP-API.md). Made-up bodies only.
@Suite struct LiftOverviewDecodingTests {
    private func decode(_ text: String) throws -> LiftOverview {
        try JSONDecoder().decode(LiftOverview.self, from: Data(text.utf8))
    }

    @Test func theContractExampleDecodesEverySection() throws {
        let overview = try decode(AppAPISamples.liftOverviewContract)

        #expect(overview.unit == "lb")
        #expect(overview.empty == nil)
        let week = try #require(overview.week.value)
        #expect(week.days.count == 2)
        #expect(week.days[1].today && week.days[1].state == "planned")
        #expect(week.stats.map(\.id) == ["sets", "volume", "last", "streak"])
        #expect(week.next?.whenText == "Next up · today")
        let tips = try #require(overview.tips.value)
        #expect(tips.items.first?.tone == .warn)
        #expect(tips.items.first?.link == .session("d5a25b33-32e0-5bcd-bc53-5f17cb084120"))
        #expect(tips.items.last?.link == .exercise("id-4c494654-0000-4000-8000-000000000019"))
        let lift = try #require(overview.lifts.value?.items.first)
        #expect(lift.changeText == "▼ 21% in 12 weeks")
        #expect(lift.best == 76)
        #expect(lift.points.first?.e1rm == 60)
        #expect(overview.muscles.value?.band == LiftBand(min: 10, max: 20))
        #expect(overview.muscles.value?.arms.first?.status == "below")
        #expect(overview.sessions.value?.logged.first?.volumeText == "6,440")
        #expect(overview.sessions.value?.upcoming.first?.badge == "Today")
        #expect(overview.exercises.value?.count == 56)
        #expect(overview.consistency.value?.heatmap.first?.days.first?.today == true)
        #expect(overview.consistency.value?.weeks.target == 2)
        #expect(overview.records.value?.items.first?.gainText == "+3 lb")
    }

    @Test func aSectionThatFailedIsFailedAndTheRestStillDecodes() throws {
        let text = AppAPISamples.liftOverviewContract.replacingOccurrences(
            of: #""muscles": {"#,
            with: #""muscles": { "ok": false }, "unused": {"#
        )
        let overview = try decode(text)

        #expect(overview.muscles == .failed)
        #expect(overview.week.value != nil)
        #expect(overview.records.value != nil)
    }

    @Test func nothingLoggedSendsTheEmptyText() throws {
        let text = AppAPISamples.liftOverviewContract.replacingOccurrences(
            of: #""empty": null"#,
            with: #""empty": { "title": "No sessions yet", "body": "Log one in Lift." }"#
        )

        #expect(try decode(text).empty == LiftEmpty(title: "No sessions yet", body: "Log one in Lift."))
    }

    @Test func linksOfEveryKindDecode() throws {
        let links = #"""
            [{ "kind": "session", "sessionId": "abc" }, { "kind": "exercise", "exerciseKey": "name-dip" },
             { "kind": "week" }, { "kind": "section", "section": "muscles" }]
            """#
        let decoded = try JSONDecoder().decode([LiftLink].self, from: Data(links.utf8))

        #expect(decoded == [.session("abc"), .exercise("name-dip"), .week, .section("muscles")])
    }

    @Test func theBundledDemoBodyDecodesWithEverySection() throws {
        let url = try #require(Bundle.main.url(forResource: "app-lift", withExtension: "json"))
        let overview = try JSONDecoder().decode(LiftOverview.self, from: Data(contentsOf: url))

        #expect(overview.week.value?.days.count == 7)
        #expect(overview.week.value?.stats.count == 4)
        #expect(overview.consistency.value?.heatmap.count == 16)
        #expect(overview.consistency.value?.heatmap.allSatisfy { $0.days.count == 7 } == true)
        #expect(overview.lifts.value?.items.isEmpty == false)
        #expect(overview.records.value?.items.isEmpty == false)
        #expect((overview.sessions.value?.logged.count ?? 0) > (overview.sessions.value?.shown ?? 0))
    }
}
