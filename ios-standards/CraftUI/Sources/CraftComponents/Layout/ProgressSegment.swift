import Foundation

/// The state of one segment in a `SegmentedProgress`.
public nonisolated enum ProgressSegment: Hashable, Sendable, CaseIterable, Identifiable {
    /// Achieved: solid accent.
    case done
    /// Scheduled but not yet done: soft accent.
    case planned
    /// Needed to meet the minimum, not yet scheduled: a sunken fill.
    case required
    /// Above the minimum and unscheduled: a dashed outline.
    case optional

    public var id: Self { self }

    /// Builds segments for a goal: done first, then planned, then required up to `required`, then optional.
    /// Shows at least `goal` segments, and more when `done` passes the goal.
    public static func segments(done: Int, planned: Int = 0, required: Int = 0, goal: Int) -> [ProgressSegment] {
        let done = max(0, done)
        let planned = max(0, planned)
        let count = max(goal, done, 0)
        return (0..<count).map { index in
            if index < done { return .done }
            if index < done + planned { return .planned }
            if index < required { return .required }
            return .optional
        }
    }

    /// "x of y": done segments of all segments, from the library's catalog (`Bundle.module` is main-actor isolated).
    @MainActor static func accessibilityValue(for segments: [ProgressSegment]) -> String {
        let done = segments.filter { $0 == .done }.count
        return String(localized: "\(done) of \(segments.count)", bundle: .module)
    }
}
