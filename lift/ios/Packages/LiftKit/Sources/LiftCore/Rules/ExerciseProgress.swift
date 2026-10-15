import Foundation

/// One logged session of an exercise, as the progress chart reads it.
public struct ProgressSession: Hashable, Sendable, Identifiable {
    /// The session's id.
    public var id: UUID
    public var day: LocalDay
    /// The load mode stamped on the session exercise (DATA-6).
    public var loadMode: LoadMode
    public var sets: [LoggedSet]

    public init(id: UUID, day: LocalDay, loadMode: LoadMode, sets: [LoggedSet]) {
        self.id = id
        self.day = day
        self.loadMode = loadMode
        self.sets = sets
    }
}

/// The set a session is remembered by: the one with the highest estimated one-rep max.
public struct TopSet: Hashable, Sendable {
    public var reps: Int?
    public var weight: Weight?

    public init(reps: Int?, weight: Weight?) {
        self.reps = reps
        self.weight = weight
    }
}

/// One session on the progress chart, every weight in the chart's unit.
public struct ProgressPoint: Hashable, Sendable, Identifiable {
    /// The session's id.
    public var id: UUID
    public var day: LocalDay
    /// The session's best estimated one-rep max (Epley); nil when no set could be estimated.
    public var estimate: Weight?
    /// The heaviest load of a working set; nil when no working set had a load.
    public var heaviest: Weight?
    public var topSet: TopSet

    public init(id: UUID, day: LocalDay, estimate: Weight?, heaviest: Weight?, topSet: TopSet) {
        self.id = id
        self.day = day
        self.estimate = estimate
        self.heaviest = heaviest
        self.topSet = topSet
    }
}

/// The sessions of one range and what they add up to.
public struct ProgressSummary: Hashable, Sendable {
    /// The range's points, oldest first.
    public var points: [ProgressPoint]
    /// The point with the highest estimate in the range.
    public var best: ProgressPoint?
    /// The last estimate minus the first, or nil with fewer than two estimated sessions.
    public var change: Weight?
    /// The day of the first estimated session, which `change` counts from.
    public var since: LocalDay?

    public init(points: [ProgressPoint], best: ProgressPoint?, change: Weight?, since: LocalDay?) {
        self.points = points
        self.best = best
        self.change = change
        self.since = since
    }
}

/// An exercise's estimated one-rep max and heaviest set per session, over time. Numbers only.
public enum ExerciseProgress {
    /// One point per session that has an estimate or a loaded working set, oldest first (ties keep their order).
    /// Warm-ups count only in a session that logged nothing else.
    public static func points(_ sessions: [ProgressSession], unit: WeightUnit) -> [ProgressPoint] {
        sessions.enumerated()
            .sorted { ($0.element.day, $0.offset) < ($1.element.day, $1.offset) }
            .compactMap { point(for: $0.element, unit: unit) }
    }

    /// The points from `range`'s first day through `today`.
    public static func summary(_ points: [ProgressPoint], range: ProgressRange, today: LocalDay) -> ProgressSummary {
        let first = range.firstDay(today: today)
        let shown = points.filter { point in
            point.day <= today && (first.map { point.day >= $0 } ?? true)
        }
        let estimated = shown.filter { $0.estimate != nil }
        let best = estimated.max { kilograms($0.estimate) < kilograms($1.estimate) }
        var change: Weight?
        if estimated.count > 1, let start = estimated.first?.estimate, let end = estimated.last?.estimate {
            change = Weight(end.value - start.converted(to: end.unit).value, end.unit)
        }
        let since = change == nil ? nil : estimated.first?.day
        return ProgressSummary(points: shown, best: best, change: change, since: since)
    }

    private static func point(for session: ProgressSession, unit: WeightUnit) -> ProgressPoint? {
        let done = session.sets.filter(\.isDone)
        let working = done.filter { $0.kind != .warmUp }
        let candidates = working.isEmpty ? done : working
        let scored = candidates.map { set in
            (set: set, estimate: OneRepMax.estimate(set: set, loadMode: session.loadMode))
        }
        let top = scored.max { lhs, rhs in
            let left = (kilograms(lhs.estimate), kilograms(lhs.set.actual?.weight), lhs.set.actual?.reps ?? 0)
            let right = (kilograms(rhs.estimate), kilograms(rhs.set.actual?.weight), rhs.set.actual?.reps ?? 0)
            return left < right
        }
        let heaviest = candidates.compactMap { $0.actual?.weight }.max { kilograms($0) < kilograms($1) }
        guard let top, top.estimate != nil || heaviest != nil else { return nil }
        return ProgressPoint(
            id: session.id,
            day: session.day,
            estimate: top.estimate?.converted(to: unit),
            heaviest: heaviest?.converted(to: unit),
            topSet: TopSet(reps: top.set.actual?.reps, weight: top.set.actual?.weight?.converted(to: unit))
        )
    }

    private static func kilograms(_ weight: Weight?) -> Double {
        weight?.converted(to: .kg).value ?? -1
    }
}
