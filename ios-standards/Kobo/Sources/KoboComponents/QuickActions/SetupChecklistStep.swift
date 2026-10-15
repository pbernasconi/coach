import Foundation

/// One step of a `SetupChecklistCard`, in display order. The copy is shown as is (it usually comes from a server or
/// the app's own onboarding model).
nonisolated public struct SetupChecklistStep: Identifiable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let caption: String?
    public let isDone: Bool

    public init(id: String, title: String, caption: String? = nil, isDone: Bool) {
        self.id = id
        self.title = title
        self.caption = caption
        self.isDone = isDone
    }
}

/// The progress maths of a setup checklist. Pure, so tests check it without rendering.
nonisolated enum SetupChecklistProgress {
    /// The steps that are done.
    static func doneCount(_ steps: [SetupChecklistStep]) -> Int {
        steps.reduce(into: 0) { count, step in if step.isDone { count += 1 } }
    }

    /// Every step counted: `totalSteps` when the app counts steps it does not list (never fewer than the rows).
    static func stepCount(_ steps: [SetupChecklistStep], totalSteps: Int?) -> Int {
        max(totalSteps ?? steps.count, steps.count)
    }

    /// One segment per counted step, the done ones first.
    static func segmentFills(_ steps: [SetupChecklistStep], totalSteps: Int?) -> [Bool] {
        let done = doneCount(steps)
        return (0..<stepCount(steps, totalSteps: totalSteps)).map { $0 < done }
    }

    /// Every counted step is done: the app usually hides the card.
    static func isComplete(_ steps: [SetupChecklistStep], totalSteps: Int?) -> Bool {
        let count = stepCount(steps, totalSteps: totalSteps)
        return count > 0 && doneCount(steps) >= count
    }
}
