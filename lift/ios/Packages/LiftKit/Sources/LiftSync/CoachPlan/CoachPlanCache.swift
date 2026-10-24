import Foundation
import LiftCore

/// Keeps the last successful Week API bodies on disk, so the plan shows offline. One body per requested start week.
/// `FileCoachPlanCache` is the live one; tests use one in memory.
public protocol CoachPlanStoring: Sendable {
    /// Every kept body, in no order.
    func load() -> [Data]
    /// Keeps `data`, the body fetched for the week of `start`, replacing the one kept for it.
    func save(_ data: Data, start: LocalDay) throws
    /// Removes the bodies for start weeks outside `range`.
    func prune(keeping range: ClosedRange<LocalDay>)
}

/// The bodies as files `<start>.json` in one folder (Application Support/CoachPlan in the app).
public struct FileCoachPlanCache: CoachPlanStoring {
    private let directory: URL

    public init(directory: URL) {
        self.directory = directory
    }

    public func load() -> [Data] {
        files().compactMap { try? Data(contentsOf: $0.url) }
    }

    public func save(_ data: Data, start: LocalDay) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try data.write(to: directory.appending(path: "\(CoachPlanDates.plain(start)).json"), options: .atomic)
    }

    public func prune(keeping range: ClosedRange<LocalDay>) {
        for file in files() where !range.contains(file.start) {
            try? FileManager.default.removeItem(at: file.url)
        }
    }

    private func files() -> [(url: URL, start: LocalDay)] {
        let urls = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        return urls.compactMap { url in
            guard url.pathExtension == "json",
                let start = CoachPlanDates.day(fromPlain: url.deletingPathExtension().lastPathComponent)
            else { return nil }
            return (url, start)
        }
    }
}

/// The weeks every kept response holds, merged: for a week in more than one response, the newest response wins.
public struct CoachPlanBook: Equatable, Sendable {
    public private(set) var weeks: [LocalDay: CoachWeek] = [:]
    /// When the newest response was made.
    public private(set) var updatedAt: Date?
    private var madeAt: [LocalDay: Date] = [:]

    public init(_ plans: [CoachPlan] = []) {
        for plan in plans { add(plan) }
    }

    /// Adds a response's weeks; a week already held from a newer response stays. An item that a newer response has
    /// in another week (the plan moved it) leaves the older week, so it never shows twice.
    public mutating func add(_ plan: CoachPlan) {
        let made = plan.generatedDate ?? .distantPast
        for week in plan.weeks where (madeAt[week.start] ?? .distantPast) <= made {
            weeks[week.start] = week
            madeAt[week.start] = made
        }
        if let date = plan.generatedDate, date > (updatedAt ?? .distantPast) { updatedAt = date }
        dropMovedItems()
    }

    /// When the response that holds the week of `start` was made; nil when the week is not held or the time is
    /// unknown. A week from an older response is as old as that response, not as the newest one.
    public func updatedAt(of start: LocalDay) -> Date? {
        madeAt[start].flatMap { $0 == .distantPast ? nil : $0 }
    }

    /// Removes each item from every week but the one from the newest response that has it.
    private mutating func dropMovedItems() {
        var newest: [String: Date] = [:]
        for (start, week) in weeks {
            let made = madeAt[start] ?? .distantPast
            for item in week.days.flatMap(\.items) where made > (newest[item.id] ?? .distantPast) {
                newest[item.id] = made
            }
        }
        for (start, week) in weeks {
            let made = madeAt[start] ?? .distantPast
            guard week.days.contains(where: { $0.items.contains { (newest[$0.id] ?? made) > made } }) else { continue }
            var kept = week
            for index in kept.days.indices {
                kept.days[index].items.removeAll { (newest[$0.id] ?? made) > made }
            }
            weeks[start] = kept
        }
    }

    /// Removes the item `id` from every kept week and returns it; nil when no kept week has it.
    mutating func take(_ id: String) -> CoachItem? {
        var found: CoachItem?
        for (start, week) in weeks where week.days.contains(where: { $0.items.contains { $0.id == id } }) {
            var kept = week
            for index in kept.days.indices {
                if found == nil { found = kept.days[index].items.first { $0.id == id } }
                kept.days[index].items.removeAll { $0.id == id }
            }
            weeks[start] = kept
        }
        return found
    }

    /// Adds `item` last on `day`, when the week that holds `day` is kept.
    mutating func place(_ item: CoachItem, on day: LocalDay) {
        for (start, week) in weeks {
            guard let index = week.days.firstIndex(where: { $0.date == day }) else { continue }
            var kept = week
            kept.days[index].items.append(item)
            weeks[start] = kept
            return
        }
    }

    /// Whether every week of `starts` is held.
    public func holds(_ starts: [LocalDay]) -> Bool {
        starts.allSatisfy { weeks[$0] != nil }
    }
}
