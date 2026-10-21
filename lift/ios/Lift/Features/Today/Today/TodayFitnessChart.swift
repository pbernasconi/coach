import Foundation
import LiftCore
import LiftSync

/// The fitness chart's data, worked out once per Today body: each plain day turned into a `Date` in the app's
/// calendar, the measured and projected runs split, and the y ranges. The view reads it on every frame of a drag, so
/// nothing here is redone per frame. Every number is the server's.
nonisolated struct TodayFitnessChart: Equatable, Sendable {
    struct Day: Equatable, Sendable {
        let date: Date
        let ctl: Double
        let atl: Double
        let tsb: Double
        let projected: Bool
    }

    struct Event: Equatable, Sendable {
        let date: Date
        /// The event's name for an A event; empty for B and C, which get a quiet rule.
        let label: String
    }

    /// Every day, oldest first.
    let days: [Day]
    /// The measured days.
    let measured: [Day]
    /// The last measured day, then the plan's projection; empty without a projection.
    let projected: [Day]
    let today: Date?
    let events: [Event]
    let zones: [FitnessZone]
    let now: FitnessNow?
    let caption: String?
    /// Fitness and fatigue, padded so no line is clipped.
    let upperDomain: ClosedRange<Double>
    /// Form, padded.
    let formDomain: ClosedRange<Double>

    init(_ fitness: TodayFitness, calendar: Calendar) {
        let date = { (day: PlainDay) in day.day.startDate(in: calendar) }
        days = fitness.days.compactMap { day in
            date(day.date).map { Day(date: $0, ctl: day.ctl, atl: day.atl, tsb: day.tsb, projected: day.projected) }
        }
        measured = days.filter { !$0.projected }
        let planned = days.filter(\.projected)
        projected = planned.isEmpty ? [] : (measured.last.map { [$0] } ?? []) + planned
        today = date(fitness.today)
        events = fitness.events.compactMap { event in
            date(event.date).map { Event(date: $0, label: event.priority == "A" ? event.name : "") }
        }
        zones = fitness.zones
        now = fitness.now
        caption = fitness.caption
        upperDomain = Self.padded(days.flatMap { [$0.ctl, $0.atl] })
        formDomain = Self.padded(days.map(\.tsb))
    }

    /// The day nearest `target`, by binary search over the sorted days.
    func nearest(to target: Date) -> Day? {
        guard !days.isEmpty else { return nil }
        var low = 0
        var high = days.count - 1
        while low < high {
            let middle = (low + high) / 2
            if days[middle].date < target { low = middle + 1 } else { high = middle }
        }
        guard low > 0 else { return days[low] }
        let before = days[low - 1]
        let after = days[low]
        return target.timeIntervalSince(before.date) <= after.date.timeIntervalSince(target) ? before : after
    }

    /// The values' range with a little room above and below.
    static func padded(_ values: [Double]) -> ClosedRange<Double> {
        guard let low = values.min(), let high = values.max() else { return 0...1 }
        let pad = max((high - low) * 0.08, 1)
        return (low - pad)...(high + pad)
    }
}
