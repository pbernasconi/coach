import Foundation
import LiftCore
import Testing

@testable import LiftSync

/// A move or delete made on the phone shows in the kept plan at once (`CoachPlanBook.apply`).
@Suite struct CoachPlanEditTests {
    let first = LocalDay(year: 2026, month: 10, day: 19)

    func week(_ start: LocalDay, items: [CoachItem]) -> CoachWeek {
        let totals = CoachTotals(text: "", plannedCount: 0, doneCount: 0, missedCount: 0)
        let days = (0..<7).map { index in
            let day = start.adding(days: index)
            return CoachDay(date: day, items: items.filter { $0.date == day })
        }
        return CoachWeek(start: start, title: nil, hasPlan: true, totals: totals, days: days)
    }

    func item(_ id: String, _ day: LocalDay) -> CoachItem {
        CoachItem(id: id, date: day, title: id, sport: "ride", subtitle: "", state: .planned, stateLabel: "Planned")
    }

    func book() -> CoachPlanBook {
        let second = first.adding(days: 7)
        return CoachPlanBook([
            CoachPlan(
                generatedAt: "2026-10-20T08:00:00Z",
                timeZone: "UTC",
                today: first,
                weeks: [
                    week(first, items: [item("a", first.adding(days: 2)), item("b", first.adding(days: 2))]),
                    week(second, items: [item("c", second)]),
                ]
            )
        ])
    }

    func placed(_ book: CoachPlanBook) -> [String: LocalDay] {
        let items = book.weeks.values.flatMap(\.days).flatMap { day in day.items.map { (day.date, $0) } }
        return Dictionary(uniqueKeysWithValues: items.map { ($1.id, $0) })
    }

    @Test func aMovePutsTheItemLastOnItsNewDay() {
        var plan = book()
        let friday = first.adding(days: 4)
        plan.apply(.move(id: "a", to: friday))
        #expect(placed(plan)["a"] == friday)
        #expect(plan.weeks[first]?.days[4].items.map(\.date) == [friday])
        #expect(plan.weeks[first]?.days[2].items.map(\.id) == ["b"])
    }

    @Test func aMoveToAnotherKeptWeekLeavesTheFirst() {
        var plan = book()
        let later = first.adding(days: 9)
        plan.apply(.move(id: "a", to: later))
        #expect(placed(plan)["a"] == later)
        #expect(plan.weeks[first.adding(days: 7)]?.days[2].items.map(\.id) == ["a"])
    }

    @Test func aMoveOutsideTheKeptWeeksOnlyDropsTheItem() {
        var plan = book()
        plan.apply(.move(id: "a", to: first.adding(days: 30)))
        #expect(placed(plan)["a"] == nil)
        #expect(placed(plan).count == 2)
    }

    @Test func aDeleteDropsTheItem() {
        var plan = book()
        plan.apply(.remove(id: "c"))
        #expect(placed(plan).keys.sorted() == ["a", "b"])
    }

    @Test func anUnknownItemChangesNothing() {
        var plan = book()
        plan.apply(.move(id: "nope", to: first))
        #expect(plan == book())
    }
}
