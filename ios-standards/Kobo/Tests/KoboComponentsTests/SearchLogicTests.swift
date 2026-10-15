import Testing

@testable import KoboComponents

/// The search pill and search-mode rules, ported from Trellis `SearchFieldLogicTests` and `SearchModeLogicTests`.
@Suite struct SearchLogicTests {
    @Test func clearShowsWhileEditingWithText() {
        #expect(SearchFieldLogic.showsClear(query: "acme", isFocused: true, hasCancel: true))
        #expect(SearchFieldLogic.showsClear(query: "acme", isFocused: true, hasCancel: false))
    }

    @Test func clearHidesWithoutText() {
        #expect(!SearchFieldLogic.showsClear(query: "", isFocused: true, hasCancel: true))
        #expect(!SearchFieldLogic.showsClear(query: "", isFocused: false, hasCancel: false))
    }

    @Test func clearHidesOutOfFocusBesideACancel() {
        #expect(!SearchFieldLogic.showsClear(query: "acme", isFocused: false, hasCancel: true))
    }

    @Test func clearShowsWithTextWhenThePillHasNoCancel() {
        #expect(SearchFieldLogic.showsClear(query: "acme", isFocused: false, hasCancel: false))
    }

    @Test func cancelShowsWhileFocusedOrHoldingAQuery() {
        #expect(SearchFieldLogic.showsCancel(query: "", isFocused: true))
        #expect(SearchFieldLogic.showsCancel(query: "acme", isFocused: false))
        #expect(!SearchFieldLogic.showsCancel(query: "", isFocused: false))
    }

    @Test func theNeedleIsTrimmedOrNil() {
        #expect(SearchFieldLogic.needle("  Inf ") == "Inf")
        #expect(SearchFieldLogic.needle("   ") == nil)
    }

    @Test func hintShowsUntilTwoCharacters() {
        #expect(SearchModeLogic.showsHint(query: ""))
        #expect(SearchModeLogic.showsHint(query: " a "))
        #expect(!SearchModeLogic.showsHint(query: "ac"))
    }

    @Test func blankQueryCannotSubmit() {
        #expect(!SearchModeLogic.canSubmit(query: "", committed: ""))
        #expect(!SearchModeLogic.canSubmit(query: "   ", committed: ""))
        #expect(SearchModeLogic.canSubmit(query: "acme", committed: ""))
    }

    @Test func blankQuerySubmitsWhileAQueryIsCommitted() {
        #expect(SearchModeLogic.canSubmit(query: "", committed: "rent"))
        #expect(SearchModeLogic.canSubmit(query: "  ", committed: "rent"))
    }
}
