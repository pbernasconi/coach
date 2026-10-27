import Foundation
import LiftCore
import LiftSync

/// Puts the coach plan's items and the local Lift sessions on their days. It matches nothing itself: an item names its
/// Lift session (`liftSessionId`), and the server decides every state.
///
/// - An item that names a local session shows that session, on the item's day (the plan's day wins).
/// - Except after this phone moved the session later than the item's plan was fetched: the session shows on its own
///   day and the item is left out, until a fetch after the server followed the move (WEEK-API.md, `dayMovedAt`).
/// - A local session that no kept item names shows on its own day, after the day's items, when the server has it too
///   (the week's `liftSessions`), something was logged in it, or it changed after the week was fetched (not synced
///   yet). Any other is a stale copy the server no longer has, and stays out: Week shows the server's truth.
/// - Without a plan (sync off, or a week not fetched yet), every day is its sessions, as before the plan existed.
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
        let known = Self.serverSessions(book)
        unlinkedByDay = Dictionary(
            grouping: summaries.filter { !linked.contains($0.id) && Self.isShown($0, known: known) },
            by: \.day
        )
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

    /// For each day of a kept week that names its Lift sessions: those ids and when the week was fetched.
    private static func serverSessions(_ book: CoachPlanBook?) -> [LocalDay: (ids: Set<String>, fetched: Date)] {
        guard let book else { return [:] }
        var out: [LocalDay: (ids: Set<String>, fetched: Date)] = [:]
        for (start, week) in book.weeks {
            guard let ids = week.liftSessions else { continue }
            let fetched = book.updatedAt(of: start) ?? .distantPast
            for day in week.days { out[day.date] = (ids, fetched) }
        }
        return out
    }

    /// Whether a local session no item names shows: the server has it, it holds logged sets, it changed after the
    /// week was fetched, or its week has no server answer to check it against.
    private static func isShown(_ session: SessionSummary, known: [LocalDay: (ids: Set<String>, fetched: Date)]) -> Bool {
        guard let server = known[session.day] else { return true }
        if server.ids.contains(session.id.uuidString.lowercased()) || session.hasLoggedSets { return true }
        guard let updated = session.updatedAt else { return false }
        return updated > server.fetched
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
    var markedDays: [(day: LocalDay, isDone: Bool, workouts: [WeekDayWorkout])] {
        Set(itemsByDay.keys).union(unlinkedByDay.keys)
            .sorted()
            .compactMap { day in
                let rows = entries(on: day).filter { !$0.isRest }
                let workouts = rows.map { WeekDayWorkout(sport: $0.sport, isDone: $0.isDone) }
                return rows.isEmpty ? nil : (day, rows.allSatisfy(\.isDone), workouts)
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
