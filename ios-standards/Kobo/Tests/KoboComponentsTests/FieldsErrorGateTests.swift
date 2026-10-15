import Testing

@testable import KoboComponents

/// Errors show on blur or on submit, never while the user types (ported from Trellis `FieldErrorGateTests`).
@Suite struct FieldsErrorGateTests {
    private func reading(_ value: String?, error: Bool, focused: Bool) -> FieldErrorGate.Reading {
        FieldErrorGate.Reading(value: value, hasError: error, focused: focused)
    }

    @Test func anErrorThatAppearsWhileTypingWaitsForTheBlur() {
        let held = FieldErrorGate.suppressed(
            false,
            old: reading("j", error: false, focused: true),
            new: reading("jd", error: true, focused: true)
        )
        #expect(held)
        #expect(!FieldErrorGate.visible(hasError: true, suppressed: held, focused: true))
    }

    @Test func anErrorThatAppearsWithNoEditShowsAtOnce() {
        let held = FieldErrorGate.suppressed(
            false,
            old: reading("jdoe", error: false, focused: true),
            new: reading("jdoe", error: true, focused: true)
        )
        #expect(!held)
        #expect(FieldErrorGate.visible(hasError: true, suppressed: held, focused: true))
    }

    @Test func aHeldBackErrorShowsOnTheBlur() {
        #expect(FieldErrorGate.visible(hasError: true, suppressed: true, focused: false))
        let held = FieldErrorGate.suppressed(
            true,
            old: reading("jd", error: true, focused: true),
            new: reading("jd", error: true, focused: false)
        )
        #expect(!held)
    }

    @Test func aClearedErrorResetsTheGate() {
        let held = FieldErrorGate.suppressed(
            true,
            old: reading("jd", error: true, focused: true),
            new: reading("jdoe@x.com", error: false, focused: true)
        )
        #expect(!held)
        #expect(!FieldErrorGate.visible(hasError: false, suppressed: held, focused: true))
    }

    @Test func aFieldWithNoValueShowsEveryErrorAtOnce() {
        let held = FieldErrorGate.suppressed(
            false,
            old: reading(nil, error: false, focused: true),
            new: reading(nil, error: true, focused: true)
        )
        #expect(!held)
    }

    @Test func theLineShowsTheErrorElseTheHelperNeverBoth() {
        #expect(FieldLineContent(hasHelper: true, error: .none) == .helper)
        #expect(FieldLineContent(hasHelper: true, error: .message("Required")) == .error("Required"))
        #expect(FieldLineContent(hasHelper: true, error: .highlight) == .none)
        #expect(FieldLineContent(hasHelper: false, error: .none) == .none)
        #expect(FieldLineContent(hasHelper: true, error: .message("")) == .helper)
    }

    @Test func errorKinds() {
        #expect(!FieldError.none.isError)
        #expect(FieldError.highlight.isError)
        #expect(FieldError.highlight.message == nil)
        #expect(FieldError.message("Too short").message == "Too short")
    }

    @Test(arguments: [
        (true, "Payroll", true, true),
        (true, " ", true, true),
        (true, "", true, false),
        (true, "Payroll", false, false),
        (false, "Payroll", true, false),
    ])
    func clearButtonShowsOnlyForAnEnabledClearableFieldWithText(
        clearable: Bool,
        text: String,
        isEnabled: Bool,
        shows: Bool
    ) {
        #expect(InputClear.shows(clearable: clearable, text: text, isEnabled: isEnabled) == shows)
    }
}
