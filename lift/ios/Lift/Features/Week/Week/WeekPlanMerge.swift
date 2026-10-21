import Foundation
import LiftCore
import LiftSync

/// Puts the coach plan's items and the local Lift sessions on their days. It matches nothing itself: an item names its
/// Lift session (`liftSessionId`), and the server decides every state.
///
/// - An item that names a local session shows that session, on the item's day (the plan's day wins).
/// - Except after this phone moved the session later than the item's plan was fetched: the session shows on its own
///   day and the item is left out, until a fetch after the server followed the move (WEEK-API.md, `dayMovedAt`).
/// - A local session that no kept item names shows on its own day, after the day's items.
/// - Without a plan (sync off), every day is its sessions, as before the plan existed.
nonisolated struct WeekPlanMerge: Sendable {
    private let itemsByDay: [LocalDay: [CoachItem]]
    private let sessionsByID: [UUID: SessionSummary]
    /// Local sessions shown on their own day: those no kept item names.
    private let unlinkedByDay: [LocalDay: [SessionSummary]]
    private let dayTitle: @Sendable (LocalDay) -> String

    init(summaries: [SessionSummary], book: CoachPlanBook?, dayTitle: @escaping @Sendable (LocalDay) -> String) {
        let byID = Dictionary(summaries.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let items = Self.items(book, sessions: byID)
        let linked = Set(
            items.compactMap(\.liftSessionId).compactMap(UUID.init(uuidString:)).filter { byID[$0] != nil }
        )
        itemsByDay = Dictionary(grouping: items, by: \.date)
        sessionsByID = byID
        unlinkedByDay = Dictionary(grouping: summaries.filter { !linked.contains($0.id) }, by: \.day)
        self.dayTitle = dayTitle
    }

    /// The kept items, without those whose session this phone moved after the item's plan was fetched.
    private static func items(_ book: CoachPlanBook?, sessions: [UUID: SessionSummary]) -> [CoachItem] {
        guard let book else { return [] }
        return book.weeks.flatMap { start, week in
            let fetched = book.updatedAt(of: start) ?? .distantPast
            return week.days.flatMap(\.items).filter { item in
                guard let id = item.liftSessionId.flatMap(UUID.init(uuidString:)), let session = sessions[id],
                    let moved = session.dayMovedAt
                else { return true }
                return session.day == item.date || moved <= fetched
            }
        }
    }

    /// The day's rows: its plan items in the server's order, each linked one as its session, then its other sessions.
    func entries(on day: LocalDay) -> [WeekEntry] {
        var shown: Set<UUID> = []
        let planned: [WeekEntry] = (itemsByDay[day] ?? []).compactMap { item in
            guard let id = item.liftSessionId.flatMap(UUID.init(uuidString:)), let session = sessionsByID[id] else {
                return .plan(WeekPlanItem(item, dayTitle: dayTitle(day)))
            }
            // Two items naming one session show it once.
            return shown.insert(id).inserted ? .session(session) : nil
        }
        return planned + (unlinkedByDay[day] ?? []).map(WeekEntry.session)
    }

    /// Every day with a row to mark in the strip (a rest item marks nothing), and whether all its rows are done.
    var markedDays: [(day: LocalDay, isDone: Bool)] {
        Set(itemsByDay.keys).union(unlinkedByDay.keys)
            .sorted()
            .compactMap { day in
                let rows = entries(on: day).filter { !$0.isRest }
                return rows.isEmpty ? nil : (day, rows.allSatisfy(\.isDone))
            }
    }

    /// The plan item `id`, as the detail sheet shows it.
    func item(_ id: String) -> WeekPlanItem? {
        for (day, items) in itemsByDay {
            if let item = items.first(where: { $0.id == id }) { return WeekPlanItem(item, dayTitle: dayTitle(day)) }
        }
        return nil
    }
}
