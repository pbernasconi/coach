import Foundation
import Testing

@testable import KoboComponents

/// Typing and pasting in the region's style, ported from Trellis's amount-locale vectors. Kobo shows grouping in the
/// region's style too, so the German edit vectors start from German text ("1.234,5").
@Suite struct FieldsLocalizedNumberTextTests {
    private static let money = NumberEntryRules(range: 0...999_999_999.99, decimalPlaces: 2)

    private static func separators(_ identifier: String) -> LocalizedNumberText.Separators {
        LocalizedNumberText.Separators(locale: Locale(identifier: identifier))
    }

    @Test func theSeparatorsComeFromTheLocale() {
        #expect(Self.separators("en_US") == .init(decimal: ".", grouping: ","))
        #expect(Self.separators("de_DE") == .init(decimal: ",", grouping: "."))
        #expect(Self.separators("fr_FR").decimal == ",")
    }

    /// One pasted text, the region's marks and the number it means.
    struct Paste: Sendable, CustomTestStringConvertible {
        let text: String
        let decimal: Character
        let grouping: Character
        let number: Double

        var testDescription: String { text }
    }

    @Test(arguments: [
        Paste(text: "12,50", decimal: ",", grouping: ".", number: 12.5),
        Paste(text: "1.234,56", decimal: ",", grouping: ".", number: 1234.56),
        Paste(text: "1,234.56", decimal: ".", grouping: ",", number: 1234.56),
        Paste(text: "12,5", decimal: ".", grouping: ",", number: 12.5),
        Paste(text: "12.50", decimal: ".", grouping: ",", number: 12.5),
        Paste(text: "$1,234.56", decimal: ".", grouping: ",", number: 1234.56),
        Paste(text: "1\u{a0}234,56", decimal: ",", grouping: "\u{202f}", number: 1234.56),
        Paste(text: "1\u{202f}234,56", decimal: ",", grouping: "\u{202f}", number: 1234.56),
        Paste(text: "12,345", decimal: ".", grouping: ",", number: 12345),
        Paste(text: "1,234,567", decimal: ".", grouping: ",", number: 1_234_567),
        Paste(text: "$1,234.56", decimal: ",", grouping: ".", number: 1234.56),
        Paste(text: "1.234", decimal: ",", grouping: ".", number: 1234),
        Paste(text: "12,5", decimal: ",", grouping: ".", number: 12.5),
        Paste(text: "1\u{2019}234.50", decimal: ".", grouping: "\u{2019}", number: 1234.5),
    ])
    func aPasteReadsInTheRegionsStyle(paste: Paste) {
        let separators = LocalizedNumberText.Separators(decimal: paste.decimal, grouping: paste.grouping)
        let typed = LocalizedNumberText.applied(previous: "", typed: paste.text, separators: separators, maxDecimals: 2)
        #expect(NumberEntryLogic.number(NumberEntryLogic.sanitize(typed, rules: Self.money).value) == paste.number)
    }

    @Test(arguments: [
        ("12", "12,", "de_DE", "12.", false),
        ("12,", "12,5", "de_DE", "12.5", false),
        ("1,234", "1,23", "en_US", "123", false),
        ("1.234", "1.23", "de_DE", "123", false),
        ("12", "12,", "en_US", "12", false),
        ("1.234,5", "1.234,56", "de_DE", "1234.56", false),
        ("12,56", "12,567", "de_DE", "12.56", true),
        ("12,5", "12,5,", "de_DE", "12.5", true),
        ("12", "12.", "en_US", "12.", false),
        ("1,234.50", "12,50", "en_US", "12.50", false),
    ])
    func anEditKeepsTheMeaningOfTheShownText(
        previous: String,
        typed: String,
        locale: String,
        value: String,
        rejected: Bool
    ) {
        let applied = LocalizedNumberText.applied(
            previous: previous,
            typed: typed,
            separators: Self.separators(locale),
            maxDecimals: 2
        )
        #expect(NumberEntryLogic.sanitize(applied, rules: Self.money) == .init(value: value, rejected: rejected))
    }

    @Test func theFieldGroupsAsTheUserTypes() {
        var field = NumberEntryText(number: nil, rules: Self.money, separators: Self.separators("en_US"))
        for (typed, shown) in [
            ("1", "1"), ("12", "12"), ("1234", "1,234"), ("1,234.", "1,234."), ("1,234.5", "1,234.5"),
        ] {
            field.text = typed
            _ = field.normalize()
            #expect(field.text == shown)
        }
        #expect(field.number == 1234.5)
        field.text = "1,234"
        _ = field.normalize()
        field.text = "1,23"
        _ = field.normalize()
        #expect(field.text == "123")
        #expect(
            NumberEntryText(number: 1250.05, rules: Self.money, separators: Self.separators("en_US")).text == "1,250.05"
        )
        #expect(NumberEntryText(number: 2, rules: Self.money, separators: Self.separators("en_US")).text == "2")
    }

    @Test func anEditAboveTheTopIsRefusedAndShakes() {
        let amount = NumberEntryRules(range: 0...500, decimalPlaces: 1)
        var field = NumberEntryText(number: 50, rules: amount, separators: Self.separators("en_US"))
        #expect(field.press(.digit(5)) == .init(number: 50, valueChanged: false, shakes: true))
        #expect(field.text == "50")
        #expect(field.press(.digit(0)) == .init(number: 500, valueChanged: true, shakes: false))
        #expect(field.press(.decimal) == .init(number: 500, valueChanged: true, shakes: false))
        #expect(field.press(.digit(5)) == .init(number: 500, valueChanged: false, shakes: true))
        field.text = "600"
        #expect(field.normalize() == .init(number: 500, valueChanged: false, shakes: true))
        #expect(field.text == "500.")
    }

    @Test func commitRaisesALowValueAndRounds() {
        let amounts = NumberEntryRules(range: 20...500, decimalPlaces: 1)
        var field = NumberEntryText(number: nil, rules: amounts, separators: Self.separators("en_US"))
        #expect(field.press(.digit(5)) == .init(number: 5, valueChanged: true, shakes: false))
        #expect(field.commit() == .init(number: 20, valueChanged: true, shakes: false))
        #expect(field.text == "20")
        #expect(field.commit() == nil)
    }

    @Test func anOutsideValueReplacesTheTextUnlessItEchoes() {
        let amount = NumberEntryRules(range: 0...500, decimalPlaces: 1)
        var field = NumberEntryText(number: nil, rules: amount, separators: Self.separators("en_US"))
        field.text = "102."
        _ = field.normalize()
        field.sync(102)
        #expect(field.text == "102.")
        field.sync(105)
        #expect(field.text == "105")
        field.sync(nil)
        #expect(field.text.isEmpty)
    }
}
