import Foundation

/// A week's sessions in the shape `SegmentedProgress` draws.
public struct WeekProgress: Hashable, Sendable {
    /// Sessions done.
    public let done: Int
    /// Sessions scheduled but not done yet.
    public let planned: Int
    /// Sessions still needed to reach the minimum: `minimum − done − planned`, floored at zero.
    public let required: Int
    /// Segments to show: the goal, never below the minimum.
    public let goal: Int
    /// The weekly minimum; pass it to `SegmentedProgress(done:planned:minimum:goal:)`.
    public let minimum: Int

    public init(done: Int, planned: Int, required: Int, goal: Int, minimum: Int) {
        self.done = done
        self.planned = planned
        self.required = required
        self.goal = goal
        self.minimum = minimum
    }

}
