import Foundation

/// Where a flow step sits in its flow, so it shows the right way out. The first step has nothing of the flow under it,
/// so it shows the ✕ and no back chevron. A later step pushed on an app's own stack shows only the back chevron, which
/// pops one step. A later step inside a modal flow shows the back chevron and the ✕, and the ✕ closes the whole flow.
///
///     FlowStep(…).environment(\.flowStepPosition, path.isEmpty ? .first : .laterInModal)
nonisolated public enum FlowStepPosition: Hashable, Sendable, CaseIterable {
    /// The first step: ✕ only.
    case first
    /// A later step on an app stack: back only.
    case later
    /// A later step inside a modal flow: back pops one step, ✕ closes the flow.
    case laterInModal

    /// The flow's ✕ shows on this step.
    public var showsExit: Bool { self != .later }

    /// A back control shows on this step.
    public var showsBack: Bool { self != .first }
}
