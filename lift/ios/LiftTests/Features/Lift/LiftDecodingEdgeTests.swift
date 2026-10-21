import Foundation
import LiftSync
import Testing

@testable import Lift

/// Bodies the contract allows that once broke a screen: a tip link kind this app does not know, and straight best
/// sets whose fields all repeat.
@Suite struct LiftDecodingEdgeTests {
    @Test func aTipWithAnUnknownLinkKindKeepsTheTipWithoutALink() throws {
        let body = #"""
            { "ok": true, "title": "Coach notes", "items": [
              { "id": "protein", "tone": "info", "title": "Protein", "body": "…", "link": { "kind": "health" } },
              { "id": "gap", "tone": "warn", "title": "Gap", "body": "…", "link": { "kind": "week" } } ] }
            """#
        let tips = try #require(try JSONDecoder().decode(AppSection<LiftTips>.self, from: Data(body.utf8)).value)
        #expect(tips.items.map(\.id) == ["protein", "gap"])
        #expect(tips.items.map(\.link) == [nil, .week])
    }

    @Test func straightBestSetsHaveDistinctIDs() throws {
        let set = #"""
            { "date": "2026-08-11", "dateText": "Tue, Aug 11, 2026", "sessionId": "6156ec87-fc83-5f6a-9244-eb8a7c3f6582",
              "weightText": "60 lb", "repsText": "8", "e1rm": 76, "e1rmText": "76 lb" }
            """#
        let body =
            #"{ "ok": true, "title": "Best sets", "caption": "Top sets.", "items": [\#(set), \#(set), \#(set)] }"#
        let best = try #require(try JSONDecoder().decode(AppSection<LiftBestSets>.self, from: Data(body.utf8)).value)
        #expect(best.items.map(\.id) == [0, 1, 2])
        #expect(Set(best.items.map(\.sessionId)).count == 1)
    }

    @Test func twoSessionsOnOneDayAreTwoChartPoints() {
        let day = Date(timeIntervalSince1970: 1_772_456_700)
        let morning = ExerciseServerPoint(date: day, e1rm: 100, sessionID: "a", label: "AM")
        let evening = ExerciseServerPoint(date: day, e1rm: 102, sessionID: "b", label: "PM")
        #expect(morning.id != evening.id)
    }

    @Test func onlyKnownSectionLinksShowAChevron() {
        #expect(LiftTipsView.opens(.section("records")))
        #expect(!LiftTipsView.opens(.section("health")))
    }

    @Test func aPageFetchedLessThanAMinuteAgoIsFresh() {
        let fetched = Date(timeIntervalSince1970: 1_772_456_700)
        #expect(LiftRefresh.isFresh(fetched, now: fetched.addingTimeInterval(59)))
        #expect(!LiftRefresh.isFresh(fetched, now: fetched.addingTimeInterval(60)))
        #expect(!LiftRefresh.isFresh(nil, now: fetched))
    }
}
