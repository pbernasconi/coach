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

    /// Adds a response's weeks; a week already held from a newer response stays.
    public mutating func add(_ plan: CoachPlan) {
        let made = plan.generatedDate ?? .distantPast
        for week in plan.weeks where (madeAt[week.start] ?? .distantPast) <= made {
            weeks[week.start] = week
            madeAt[week.start] = made
        }
        if let date = plan.generatedDate, date > (updatedAt ?? .distantPast) { updatedAt = date }
    }

    /// Whether every week of `starts` is held.
    public func holds(_ starts: [LocalDay]) -> Bool {
        starts.allSatisfy { weeks[$0] != nil }
    }
}
