import Foundation
import Testing

@testable import KoboComponents

/// `NumberEntry` canonical-text maths, with a nine-digit,
/// two-decimal rule set standing in for the money field.
@Suite struct FieldsNumberEntryLogicTests {
    static let money = NumberEntryRules(range: 0...999_999_999.99, decimalPlaces: 2)
    static let amount = NumberEntryRules(range: 0...500, decimalPlaces: 1)
    static let us = LocalizedNumberText.Separators(decimal: ".", grouping: ",")

    @Test func integerDigitsFollowTheUpperBound() {
        #expect(Self.money.maxIntegerDigits == 9)
        #expect(Self.amount.maxIntegerDigits == 3)
        #expect(NumberEntryRules(range: 0...0.5, decimalPlaces: 2).maxIntegerDigits == 1)
        #expect(NumberEntryRules(range: 0...50, maxIntegerDigits: 4).maxIntegerDigits == 4)
    }

    @Test(arguments: [
        ("5", "5", false),
        ("1,234", "1234", false),
        ("007", "7", false),
        ("0", "0", false),
        ("$1 234.50 USD", "1234.50", false),
        ("1111111111", "111111111", true),
        (".", "0.", false),
        ("12.", "12.", false),
        ("12.34", "12.34", false),
        ("12.345", "12.34", true),
        ("1.2.3", "1.23", true),
        ("999999999.99", "999999999.99", false),
    ])
    func sanitizeCutsAndFlags(typed: String, value: String, rejected: Bool) {
        #expect(NumberEntryLogic.sanitize(typed, rules: Self.money) == .init(value: value, rejected: rejected))
    }

    @Test func aWholeNumberFieldCutsTheDecimalPoint() {
        let guests = NumberEntryRules(range: 1...50)
        #expect(NumberEntryLogic.sanitize("12.", rules: guests) == .init(value: "12", rejected: true))
        #expect(NumberEntryLogic.sanitize("123", rules: guests) == .init(value: "12", rejected: true))
    }

    @Test(
        arguments: [
            ("", nil),
            ("0.", 0.0),
            ("12", 12.0),
            ("12.5", 12.5),
            ("12.34", 12.34),
            ("0.05", 0.05),
            ("999999999.99", 999_999_999.99),
        ] as [(String, Double?)]
    )
    func canonicalTextReadsAsANumber(value: String, number: Double?) {
        #expect(NumberEntryLogic.number(value) == number)
    }

    @Test(arguments: [
        ("", ""),
        ("1234", "1,234"),
        ("1234567", "1,234,567"),
        ("1234.", "1,234."),
        ("1234.5", "1,234.5"),
        ("1234.56", "1,234.56"),
        ("0.05", "0.05"),
    ])
    func displayGroupsWholeDigitsAndKeepsPartialDecimals(value: String, display: String) {
        #expect(NumberEntryLogic.display(value, separators: Self.us) == display)
    }

    @Test func displayUsesTheRegionsMarks() {
        let german = LocalizedNumberText.Separators(decimal: ",", grouping: ".")
        #expect(NumberEntryLogic.display("1234.5", separators: german) == "1.234,5")
        let none = LocalizedNumberText.Separators(decimal: ".", grouping: nil)
        #expect(NumberEntryLogic.display("1234.5", separators: none) == "1234.5")
    }

    @Test(arguments: [
        (102.5, 1, "102.5"),
        (100.0, 1, "100"),
        (0.05, 2, "0.05"),
        (1.10, 2, "1.1"),
        (102.46, 1, "102.5"),
    ])
    func canonicalOfANumberHasNoTrailingZeros(number: Double, places: Int, text: String) {
        #expect(NumberEntryLogic.canonical(number, decimalPlaces: places) == text)
    }

    @Test func canonicalOfNothingOrANegativeIsEmpty() {
        #expect(NumberEntryLogic.canonical(nil, decimalPlaces: 1).isEmpty)
        #expect(NumberEntryLogic.canonical(-3, decimalPlaces: 1).isEmpty)
        #expect(NumberEntryLogic.canonical(.infinity, decimalPlaces: 1).isEmpty)
    }

    @Test func commitClampsAndRounds() {
        #expect(NumberEntryLogic.committed(612, rules: Self.amount) == 500)
        #expect(NumberEntryLogic.committed(102.46, rules: Self.amount) == 102.5)
        #expect(NumberEntryLogic.committed(5, rules: NumberEntryRules(range: 20...500)) == 20)
        #expect(NumberEntryLogic.isOver("501", rules: Self.amount))
        #expect(!NumberEntryLogic.isOver("500", rules: Self.amount))
        #expect(!NumberEntryLogic.isOver("", rules: Self.amount))
    }

    @Test func keypadAppendsDeletesAndAddsOneDecimalPoint() {
        var value = ""
        for key: NumberEntryKey in [.digit(1), .digit(0), .digit(2), .decimal, .digit(5)] {
            value = NumberEntryLogic.pressing(key, on: value, rules: Self.amount).value
        }
        #expect(value == "102.5")
        #expect(
            NumberEntryLogic.pressing(.decimal, on: value, rules: Self.amount) == .init(value: value, rejected: true)
        )
        #expect(
            NumberEntryLogic.pressing(.digit(7), on: value, rules: Self.amount) == .init(value: "102.5", rejected: true)
        )
        #expect(NumberEntryLogic.pressing(.delete, on: value, rules: Self.amount).value == "102.")
        #expect(NumberEntryLogic.pressing(.delete, on: "", rules: Self.amount) == .init(value: "", rejected: true))
        #expect(NumberEntryLogic.pressing(.decimal, on: "", rules: Self.amount).value == "0.")
        #expect(NumberEntryLogic.pressing(.digit(0), on: "0", rules: Self.amount).value == "0")
        #expect(NumberEntryLogic.pressing(.digit(4), on: "999", rules: Self.amount).rejected)
    }

    @Test func keypadRowsFollowThePhoneLayout() {
        #expect(NumberEntryKey.rows(allowsDecimal: true).last == [.decimal, .digit(0), .delete])
        #expect(NumberEntryKey.rows(allowsDecimal: false).last == [.digit(0), .delete])
        #expect(NumberEntryKey.rows(allowsDecimal: true).flatMap(\.self).count == 12)
    }

    @Test func heroDigitsScaleToFitTheColumn() {
        #expect(NumberEntrySizing.fittedScale(contentWidth: 120, availableWidth: 343) == 1)
        #expect(NumberEntrySizing.fittedScale(contentWidth: 400, availableWidth: 0) == 1)
        #expect(NumberEntrySizing.fittedScale(contentWidth: 0, availableWidth: 343) == 1)
        #expect(NumberEntrySizing.fittedScale(contentWidth: 686, availableWidth: 343) == 0.5)
        #expect(
            NumberEntrySizing.fittedScale(contentWidth: 10_000, availableWidth: 343) == NumberEntrySizing.minimumScale
        )
    }
}
