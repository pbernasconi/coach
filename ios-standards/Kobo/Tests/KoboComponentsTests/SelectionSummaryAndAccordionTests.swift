import Testing

@testable import KoboComponents

@Suite struct SelectionSummaryAndAccordionTests {
    private let timers = ["60", "90", "120", "180"]

    @Test func summaryNamesNothingOneAllOrACount() {
        #expect(SelectSummary.of([], in: timers) == .none)
        #expect(SelectSummary.of(["120"], in: timers) == .one(index: 2))
        #expect(SelectSummary.of(["60", "180"], in: timers) == .count(2))
        #expect(SelectSummary.of(Set(timers), in: timers) == .all)
    }

    @Test func summaryIgnoresValuesTheOptionsNoLongerList() {
        #expect(SelectSummary.of(["300"], in: timers) == .none)
        #expect(SelectSummary.of(["300", "90"], in: timers) == .one(index: 1))
    }

    @Test func aSingleOptionChosenIsNamedNotAll() {
        #expect(SelectSummary.of(["only"], in: ["only"]) == .one(index: 0))
    }

    @Test func orderedKeepsTheOptionsOrder() {
        #expect(SelectSummary.ordered(["180", "60"], in: timers) == ["60", "180"])
    }

    @Test func atMostOneOpensOneAndClosesTheOpenOneOnATap() {
        #expect(AccordionExpansion.toggled("a", expanded: nil, mode: .atMostOne) == "a")
        #expect(AccordionExpansion.toggled("b", expanded: "a", mode: .atMostOne) == "b")
        #expect(AccordionExpansion.toggled("a", expanded: "a", mode: .atMostOne) == nil)
    }

    @Test func exactlyOneKeepsTheOpenSectionOpen() {
        #expect(AccordionExpansion.toggled("a", expanded: "a", mode: .exactlyOne) == "a")
        #expect(AccordionExpansion.toggled("b", expanded: "a", mode: .exactlyOne) == "b")
    }

    @Test func closingASectionThatIsNotOpenChangesNothing() {
        #expect(AccordionExpansion.setting("b", isExpanded: false, expanded: "a", mode: .atMostOne) == "a")
        #expect(AccordionExpansion.setting("b", isExpanded: false, expanded: nil, mode: .atMostOne) == nil)
        #expect(AccordionExpansion.setting("b", isExpanded: true, expanded: "a", mode: .atMostOne) == "b")
    }
}
