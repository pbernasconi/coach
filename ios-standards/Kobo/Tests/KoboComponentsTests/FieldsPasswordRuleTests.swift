import Testing

@testable import KoboComponents

/// The generic password checklist, with rules passed in.
@Suite struct FieldsPasswordRuleTests {
    private let rules: [PasswordRule] = [
        .minimumLength(8, label: "At least 8 characters"),
        .mixedCase(label: "Upper and lowercase letters"),
        .digit(label: "At least one number"),
        .symbol(label: "At least one symbol"),
    ]

    private func met(_ value: String) -> [String] {
        rules.evaluate(value).filter(\.isMet).map(\.id)
    }

    @Test func theLabelsKeepTheirOrder() {
        #expect(
            rules.evaluate("").map(\.label) == [
                "At least 8 characters", "Upper and lowercase letters", "At least one number", "At least one symbol",
            ]
        )
    }

    @Test func anEmptyValueMeetsNoRule() {
        #expect(met("").isEmpty)
    }

    @Test func eachRuleCountsOnItsOwn() {
        #expect(met("abcdefgh") == ["length-8"])
        #expect(met("aB") == ["case"])
        #expect(met("7") == ["digit"])
        #expect(met("#") == ["symbol"])
    }

    @Test func aSpaceIsASymbol() {
        #expect(met(" ") == ["symbol"])
    }

    @Test func lettersInAnyScriptCount() {
        #expect(met("Éé") == ["case"])
    }

    @Test func allMetOnlyWhenEveryRuleIsMet() {
        #expect(rules.allMet(by: "Correct7!"))
        #expect(!rules.allMet(by: "Correct77"))
        #expect([PasswordRule]().allMet(by: ""))
    }

    @Test func aCustomRuleRunsItsOwnTest() {
        let noSpaces = PasswordRule(id: "spaces", label: "No spaces") { !$0.contains(" ") }
        #expect(noSpaces.isMet(by: "abc"))
        #expect(!noSpaces.isMet(by: "a c"))
    }

    @Test func revealMovesFocusToTheShownField() {
        #expect(SecureFieldFocus.after(toggle: .secure, revealed: true) == .plain)
        #expect(SecureFieldFocus.after(toggle: .plain, revealed: false) == .secure)
        #expect(SecureFieldFocus.after(toggle: nil, revealed: true) == nil)
    }
}
