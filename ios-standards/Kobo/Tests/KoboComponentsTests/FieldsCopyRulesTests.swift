import Testing

@testable import KoboComponents

/// Copy feedback and masked values, ported from an earlier app `TapToCopyTests`, `CopyConfirmationTests` and `CopyableValue`.
@Suite struct FieldsCopyRulesTests {
    @Test func theValueDimsButStaysLegibleAndTheCheckHoldsBriefly() {
        #expect(CopyRules.dimmedOpacity > 0 && CopyRules.dimmedOpacity < 1)
        #expect(CopyRules.checkHold == .milliseconds(1500))
        #expect(CopyRules.checkStartScale == 0.6)
        #expect(CopyRules.defaultLifetime == .seconds(60))
    }

    @Test func theConfirmationStartsWithACapital() {
        #expect(CopyRules.capitalizedFirst("routing number") == "Routing number")
        #expect(CopyRules.capitalizedFirst("élan code") == "Élan code")
        #expect(CopyRules.capitalizedFirst("").isEmpty)
    }

    @Test func aMaskShowsUntilRevealed() {
        #expect(CopyRules.displayed(value: "8820014821", maskedValue: "••4821", revealed: false) == "••4821")
        #expect(CopyRules.displayed(value: "8820014821", maskedValue: "••4821", revealed: true) == "8820014821")
        #expect(CopyRules.displayed(value: nil, maskedValue: "••4821", revealed: true) == "••4821")
        #expect(CopyRules.displayed(value: "121144269", maskedValue: nil, revealed: false) == "121144269")
    }

    @Test func revealNeedsAValueAMaskAndTheOptIn() {
        #expect(CopyRules.canReveal(value: "8820014821", maskedValue: "••4821", revealable: true))
        #expect(!CopyRules.canReveal(value: nil, maskedValue: "••4821", revealable: true))
        #expect(!CopyRules.canReveal(value: "8820014821", maskedValue: nil, revealable: true))
        #expect(!CopyRules.canReveal(value: "8820014821", maskedValue: "••4821", revealable: false))
    }
}
