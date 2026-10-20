import Foundation
import Testing

@testable import KoboComponents

/// `DateFieldLogic.evaluate` and the text state.
@Suite struct FieldsDateEvaluationTests {
    private typealias Logic = FieldsDateFieldLogicTests
    private let calendar = Logic.calendar
    private let july24 = Logic.day("2026-07-24")

    private func weekdaysOnly() -> @Sendable (Date) -> Bool {
        let calendar = calendar
        return { calendar.isDateInWeekend($0) }
    }

    private func evaluate(_ text: String, _ bounds: DateBounds = DateBounds()) -> DateFieldLogic.Evaluation {
        DateFieldLogic.evaluate(text, pattern: Logic.us, bounds: bounds, calendar: calendar)
    }

    @Test(arguments: ["", "0", "03/14", "03/14/197"])
    func partialTextIsNotAnError(text: String) {
        let result = evaluate(text)
        #expect(result == (text.isEmpty ? .empty : .incomplete))
        #expect(result.date == nil)
    }

    @Test(arguments: ["02/30/1971", "13/01/2026", "02/29/2023"])
    func impossibleDaysAreInvalid(text: String) {
        #expect(evaluate(text) == .invalid)
    }

    @Test func aLeapDayIsValid() {
        #expect(evaluate("02/29/2024") == .valid(Logic.day("2024-02-29") ?? .distantPast))
    }

    @Test func boundsRefuseAndNeverClamp() throws {
        let bounds = DateBounds(minDate: july24, maxDate: Logic.day("2026-12-31"))
        #expect(evaluate("07/23/2026", bounds) == .beforeMin(try #require(Logic.day("2026-07-23"))))
        #expect(evaluate("01/01/2027", bounds) == .afterMax(try #require(Logic.day("2027-01-01"))))
        #expect(evaluate("07/24/2026", bounds) == .valid(try #require(july24)))
        #expect(evaluate("12/31/2026", bounds) == .valid(try #require(Logic.day("2026-12-31"))))
    }

    @Test func disabledDaysAreUnavailableButTheRangeComesFirst() throws {
        let weekdays = DateBounds(isDateDisabled: weekdaysOnly())
        #expect(evaluate("07/25/2026", weekdays) == .unavailable(try #require(Logic.day("2026-07-25"))))
        #expect(evaluate("07/24/2026", weekdays) == .valid(try #require(july24)))
        let both = DateBounds(minDate: Logic.day("2026-07-26"), isDateDisabled: weekdaysOnly())
        #expect(evaluate("07/25/2026", both) == .beforeMin(try #require(Logic.day("2026-07-25"))))
    }

    @Test func eachRejectionHasItsMessage() {
        let messages = DateFieldMessages(invalid: "invalid", beforeMin: "min", afterMax: "max", unavailable: "off")
        let day = july24 ?? .distantPast
        #expect(DateFieldLogic.errorMessage(.invalid, messages: messages) == "invalid")
        #expect(DateFieldLogic.errorMessage(.beforeMin(day), messages: messages) == "min")
        #expect(DateFieldLogic.errorMessage(.afterMax(day), messages: messages) == "max")
        #expect(DateFieldLogic.errorMessage(.unavailable(day), messages: messages) == "off")
        #expect(DateFieldLogic.errorMessage(.incomplete, messages: messages) == nil)
        #expect(DateFieldLogic.errorMessage(.valid(day), messages: messages) == nil)
    }

    @Test func formatWritesAHeldDateInThePattern() {
        #expect(DateFieldLogic.format(july24, pattern: Logic.us, calendar: calendar) == "07/24/2026")
        #expect(DateFieldLogic.format(nil, pattern: Logic.us, calendar: calendar).isEmpty)
    }

    @Test func aCompleteValidDateReportsOnce() {
        var field = DateFieldText(value: nil, pattern: Logic.us, calendar: calendar)
        field.text = "07242026"
        field.normalize()
        #expect(field.text == "07/24/2026")
        #expect(field.settle(DateBounds()) == .init(date: july24))
        #expect(field.settle(DateBounds()) == nil)
    }

    @Test func aRejectedDateReportsNilAndKeepsTheText() {
        var field = DateFieldText(value: july24, pattern: Logic.us, calendar: calendar)
        field.text = "07/23/2026"
        let bounds = DateBounds(minDate: july24)
        #expect(field.settle(bounds) == .init(date: nil))
        #expect(field.text == "07/23/2026")
        #expect(field.settle(bounds) == nil)
    }

    @Test func aPartialDateReportsNothingAndBlurRestoresTheHeldDate() {
        var field = DateFieldText(value: july24, pattern: Logic.us, calendar: calendar)
        field.text = "07/24/20"
        #expect(field.settle(DateBounds()) == nil)
        field.blurred(held: july24)
        #expect(field.text == "07/24/2026")
    }

    @Test func aBoundThatMovesPastTheHeldDateRejectsIt() {
        var field = DateFieldText(value: july24, pattern: Logic.us, calendar: calendar)
        #expect(field.settle(DateBounds()) == nil)
        #expect(field.settle(DateBounds(minDate: Logic.day("2026-07-25"))) == .init(date: nil))
    }

    @Test func aPickReplacesTheTextAndItsEchoDoesNotRewriteIt() throws {
        var field = DateFieldText(value: nil, pattern: Logic.us, calendar: calendar)
        let pick = try #require(july24)
        #expect(field.pick(pick.addingTimeInterval(3600)) == .init(date: pick))
        field.sync(pick)
        #expect(field.text == "07/24/2026")
        field.sync(nil)
        #expect(field.text.isEmpty)
    }
}
