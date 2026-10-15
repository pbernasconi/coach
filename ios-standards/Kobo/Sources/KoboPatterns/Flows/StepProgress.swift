import Foundation

/// Where a flow is: step `current` of `total`, counted from 1. `total` is `nil` while the flow does not know its own
/// length yet (a later answer decides a branch), so the indicator never claims a total that could change.
///
///     StepProgress(2, of: 4).isFilled(1)  // true: steps 1 and 2 are filled
///     StepProgress(3, of: nil).segmentCount  // 1: one continuous track, nothing filled
nonisolated public struct StepProgress: Hashable, Sendable {
    /// The showing step, clamped to `1...total`.
    public let current: Int
    /// The number of steps, at least 1, or `nil` while unknown.
    public let total: Int?

    public init(_ current: Int, of total: Int?) {
        let total = total.map { max($0, 1) }
        self.total = total
        self.current = min(max(current, 1), total ?? Int.max)
    }

    /// How many segments or dots the indicator draws: `total`, or one track while the total is unknown.
    public var segmentCount: Int { total ?? 1 }

    /// Whether the segment at `index` (from 0) is filled. Every step up to and including the current one is; an
    /// unknown total fills nothing, because a full single track would read as "done".
    public func isFilled(_ index: Int) -> Bool {
        total != nil && index < current
    }

    /// Whether the dot at `index` (from 0) is the current step.
    public func isCurrent(_ index: Int) -> Bool {
        index == current - 1
    }

    /// The filled share of a continuous bar, `0...1`; 0 while the total is unknown.
    public var fraction: Double {
        guard let total else { return 0 }
        return Double(current) / Double(total)
    }

    /// True on the last step of a flow whose length is known.
    public var isLast: Bool { current == total }

    /// The progress `offset` steps away, clamped to the flow.
    public func advanced(by offset: Int) -> StepProgress {
        StepProgress(current + offset, of: total)
    }
}
