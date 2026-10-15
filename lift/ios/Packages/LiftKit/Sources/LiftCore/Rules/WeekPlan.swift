import Foundation

/// Weekly session counts against a minimum.
public enum WeekPlan {
    public static let defaultMinimum = 2

    /// Progress from counts. Negative inputs count as zero; the goal is never below the minimum.
    public static func progress(done: Int, planned: Int, minimum: Int = defaultMinimum, goal: Int? = nil)
        -> WeekProgress
    {
        let done = max(0, done)
        let planned = max(0, planned)
        let minimum = max(0, minimum)
        return WeekProgress(
            done: done,
            planned: planned,
            required: max(0, minimum - done - planned),
            goal: max(goal ?? minimum, minimum),
            minimum: minimum
        )
    }

    /// Progress from a week's sessions: completed ones are done, the rest are planned; deleted ones are ignored.
    public static func progress(sessions: [Session], minimum: Int = defaultMinimum, goal: Int? = nil)
        -> WeekProgress
    {
        let live = sessions.filter { $0.deletedAt == nil }
        let done = live.filter(\.isCompleted).count
        return progress(done: done, planned: live.count - done, minimum: minimum, goal: goal)
    }
}
