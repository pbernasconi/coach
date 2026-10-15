import Foundation
import Testing

@testable import KoboComponents

/// Typed dates, ported from Trellis's date-picker-field vectors (contracts/ui-vectors) and edge-case tests, in the
/// US month/day/year pattern plus the other two orders.
@Suite struct FieldsDateFieldLogicTests {
    static let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        calendar.locale = Locale(identifier: "en_US_POSIX")
        return calendar
    }()
    static let us = DateFieldPattern(order: .monthDayYear, separator: "/")

    static func day(_ iso: String) -> Date? {
        let parts = iso.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return DateFieldLogic.date(year: parts[0], month: parts[1], day: parts[2], calendar: calendar)
    }

    private func normalize(_ raw: String, _ pattern: DateFieldPattern = us) -> String {
        DateFieldLogic.normalize(raw, pattern: pattern, calendar: Self.calendar)
    }

    @Test(arguments: [
        ("0", "0"), ("03", "03"), ("031", "03/1"), ("0314", "03/14"), ("03/141", "03/14/1"),
        ("03/141971", "03/14/1971"), ("a0b3c1d4e1971xyz999", "03/14/1971"), ("12/25/19", "12/25/19"),
        ("2026-07-24", "07/24/2026"), ("3/4/1971", "03/04/1971"), ("3/4/71", "03/04/1971"),
        ("Jul 24, 2026", "07/24/2026"), ("July 24, 2026", "07/24/2026"), ("Jul 24 2026", "07/24/2026"),
        ("jul 24, 2026", "07/24/2026"), ("  2026-07-24 ", "07/24/2026"), ("12/251", "12/25/1"),
        ("September 30, 2026", "09/30/2026"), ("September 30 2026", "09/30/2026"), ("Sep 30, 2026", "09/30/2026"),
        ("2026-12-31", "12/31/2026"),
    ])
    func normalizeMasksTypingAndParsesPastes(raw: String, text: String) {
        #expect(normalize(raw) == text)
    }

    @Test func twoDigitYearsAbove60AreLastCentury() {
        #expect(normalize("3/4/59") == "03/04/2059")
        #expect(normalize("3/4/60") == "03/04/2060")
        #expect(normalize("3/4/61") == "03/04/1961")
        #expect(normalize("3/4/197") == "03/04/0197")
    }

    @Test func textNoFormatAcceptsFallsBackToTheMask() {
        #expect(normalize("13/4/2026") == "13/42/026")
        #expect(normalize("Jul 4,2026") == "42/02/6")
        #expect(normalize("Sept 30, 2026") == "30/20/26")
        #expect(normalize("September ").isEmpty)
        #expect(normalize("JULY 4, 2026") == "07/04/2026")
        #expect(normalize("may 4 2026") == "05/04/2026")
        #expect(normalize("24 July 2026") == "07/24/2026")
    }

    @Test func otherOrdersMaskAndParseInTheirOwnOrder() {
        let german = DateFieldPattern(order: .dayMonthYear, separator: ".")
        let japanese = DateFieldPattern(order: .yearMonthDay, separator: "/")
        #expect(normalize("24072026", german) == "24.07.2026")
        #expect(normalize("24.7.26", german) == "24.07.2026")
        #expect(normalize("20260724", japanese) == "2026/07/24")
        #expect(normalize("2026-07-24", german) == "24.07.2026")
        #expect(german.hint == "DD.MM.YYYY")
        #expect(Self.us.hint == "MM/DD/YYYY")
    }

    @Test(arguments: [
        ("MM/dd/y", DateFieldPattern.Order.monthDayYear, "/" as Character),
        ("dd.MM.y", .dayMonthYear, "."),
        ("y/MM/dd", .yearMonthDay, "/"),
        ("y-MM-dd", .yearMonthDay, "-"),
    ])
    func patternsComeFromTheRegionsFormat(format: String, order: DateFieldPattern.Order, separator: Character) {
        #expect(DateFieldPattern.parse(format) == DateFieldPattern(order: order, separator: separator))
    }

    @Test func aFormatWithoutThreeNumericPartsHasNoPattern() {
        #expect(DateFieldPattern.parse("EEEE") == nil)
    }

    @Test func aLocalePatternIsAlwaysUsable() {
        let pattern = DateFieldPattern(locale: Locale(identifier: "en_US"))
        #expect(pattern.mask("07242026").count == 10)
    }
}
