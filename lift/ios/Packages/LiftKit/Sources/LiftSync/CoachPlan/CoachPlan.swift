import Foundation
import LiftCore

/// The athlete's full weekly plan, every sport, as `GET /api/lift/week` sends it (lift/WEEK-API.md). The server
/// computes every state, label and total; the phone shows them as they are. Days are plain `YYYY-MM-DD` text, read
/// into `LocalDay`, never into a `Date`.
public struct CoachPlan: Decodable, Equatable, Sendable {
    /// When the server made the response (ISO 8601), kept as text; `generatedDate` reads it.
    public var generatedAt: String
    public var timeZone: String
    public var today: LocalDay
    public var weeks: [CoachWeek]

    public init(generatedAt: String, timeZone: String, today: LocalDay, weeks: [CoachWeek]) {
        self.generatedAt = generatedAt
        self.timeZone = timeZone
        self.today = today
        self.weeks = weeks
    }

    private enum CodingKeys: String, CodingKey { case generatedAt, timeZone, today, weeks }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        generatedAt = try container.decode(String.self, forKey: .generatedAt)
        timeZone = try container.decode(String.self, forKey: .timeZone)
        today = try container.plainDay(forKey: .today)
        weeks = try container.decode([CoachWeek].self, forKey: .weeks)
    }

    /// `generatedAt` as a date, or nil when the text is not ISO 8601.
    public var generatedDate: Date? {
        CoachPlanDates.date(fromISO: generatedAt)
    }
}

/// One week of the plan, Monday first.
public struct CoachWeek: Decodable, Equatable, Sendable {
    public var start: LocalDay
    public var title: String?
    public var hasPlan: Bool
    public var totals: CoachTotals
    /// Always seven, Monday first.
    public var days: [CoachDay]

    public init(start: LocalDay, title: String?, hasPlan: Bool, totals: CoachTotals, days: [CoachDay]) {
        self.start = start
        self.title = title
        self.hasPlan = hasPlan
        self.totals = totals
        self.days = days
    }

    private enum CodingKeys: String, CodingKey { case start, title, hasPlan, totals, days }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        start = try container.plainDay(forKey: .start)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        hasPlan = try container.decodeIfPresent(Bool.self, forKey: .hasPlan) ?? false
        totals = try container.decode(CoachTotals.self, forKey: .totals)
        days = try container.decode([CoachDay].self, forKey: .days)
    }
}

/// The week's sums. Only `text` is shown; the counts are there for tests and accessibility.
public struct CoachTotals: Decodable, Equatable, Sendable {
    /// "2/9 done · 2:10 of 9:00 · 140 of 520 TSS".
    public var text: String
    public var plannedCount: Int
    public var doneCount: Int
    public var missedCount: Int

    public init(text: String, plannedCount: Int, doneCount: Int, missedCount: Int) {
        self.text = text
        self.plannedCount = plannedCount
        self.doneCount = doneCount
        self.missedCount = missedCount
    }
}

/// One day: its items in the web's order. No items is a free day.
public struct CoachDay: Decodable, Equatable, Sendable {
    public var date: LocalDay
    public var items: [CoachItem]

    public init(date: LocalDay, items: [CoachItem]) {
        self.date = date
        self.items = items
    }

    private enum CodingKeys: String, CodingKey { case date, items }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        date = try container.plainDay(forKey: .date)
        items = try container.decodeIfPresent([CoachItem].self, forKey: .items) ?? []
    }
}

/// An item's state, as the server worked it out. An unknown value reads as `planned`.
public enum CoachItemState: String, Decodable, Equatable, Sendable, CaseIterable {
    case planned, today, done, missed, skipped

    public init(from decoder: any Decoder) throws {
        let text = try decoder.singleValueContainer().decode(String.self)
        self = CoachItemState(rawValue: text) ?? .planned
    }
}

/// One line of a structured workout: "Warm up" · "10:00 · 55–75% FTP".
public struct CoachStep: Decodable, Equatable, Sendable {
    public var label: String
    public var detail: String

    public init(label: String, detail: String) {
        self.label = label
        self.detail = detail
    }
}

/// The activity that completed an item.
public struct CoachDone: Decodable, Equatable, Sendable {
    public var source: String
    public var name: String?
    public var minutes: Double?
    public var tss: Double?
    /// Done against planned, display-ready: "62 min · 70 TSS / 60 min · 45 TSS".
    public var text: String?

    public init(source: String, name: String?, minutes: Double?, tss: Double?, text: String? = nil) {
        self.source = source
        self.name = name
        self.minutes = minutes
        self.tss = tss
        self.text = text
    }
}

extension KeyedDecodingContainer {
    /// A plain `YYYY-MM-DD` day.
    func plainDay(forKey key: Key) throws -> LocalDay {
        let text = try decode(String.self, forKey: key)
        guard let day = CoachPlanDates.day(fromPlain: text) else {
            throw DecodingError.dataCorruptedError(forKey: key, in: self, debugDescription: "not a YYYY-MM-DD day")
        }
        return day
    }
}
