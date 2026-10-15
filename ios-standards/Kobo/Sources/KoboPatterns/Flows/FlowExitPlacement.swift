import Foundation

/// Where a flow step puts its ✕ and whether the system back chevron stays, and what a tap on the ✕ does. A screen
/// places the ✕ once: a step inside another step's toolbar adds no second one.
nonisolated enum FlowExitPlacement: Equatable, Sendable {
    /// The ✕, and no system back chevron (the first step).
    case exit
    /// The ✕ beside the back chevron (a later step inside a modal flow).
    case exitKeepingBack
    /// No ✕: a later step on an app stack, a step with no exit, or a ✕ already placed above.
    case none

    static func placement(position: FlowStepPosition, hasExit: Bool, isInstalledAbove: Bool) -> FlowExitPlacement {
        guard hasExit, position.showsExit, !isInstalledAbove else { return .none }
        return position.showsBack ? .exitKeepingBack : .exit
    }

    /// The step hides the system back chevron: on the first step with a ✕, and whenever the step draws its own back
    /// control (`onBack`), so there are never two.
    static func hidesSystemBack(_ placement: FlowExitPlacement, hasCustomBack: Bool) -> Bool {
        placement == .exit || hasCustomBack
    }
}

/// What a tap on the flow's ✕ does: leave at once, or ask first when the person has entered something they would lose.
nonisolated enum FlowExitDecision: Equatable, Sendable {
    case leave
    case confirm

    static func onTap(hasUnsavedProgress: Bool) -> FlowExitDecision {
        hasUnsavedProgress ? .confirm : .leave
    }
}
