import KoboComponents
import KoboTokens
import SwiftUI

/// The ✕ that leaves a whole flow, and what it asks first. While `hasUnsavedProgress` is true a tap asks "Leave without
/// finishing?" (or the caller's copy) and leaves only on the destructive confirm; otherwise it leaves at once.
///
///     FlowExitAction(hasUnsavedProgress: !draft.isEmpty) { send(.exitTapped) }
///     FlowExitAction("Close import", hasUnsavedProgress: true,
///                    confirmTitle: "Stop importing?", confirmMessage: "The pasted text won't be kept.",
///                    confirmLabel: "Stop") { dismiss() }
///
/// Place it with `FlowStep(exit:)`, `ProgressFlowStep(exit:)` or `.flowExitToolbar(_:)`; the step position decides
/// whether the ✕ shows (`FlowStepPosition`).
public struct FlowExitAction {
    /// The accessibility label of the ✕; the library's "Close" when `nil`.
    let accessibilityLabel: LocalizedStringKey?
    let hasUnsavedProgress: Bool
    let confirmTitle: Text
    let confirmMessage: Text?
    let confirmLabel: Text
    let action: () -> Void

    /// - Parameters:
    ///   - accessibilityLabel: what VoiceOver reads for the ✕ ("Close import"); the library's "Close" when `nil`.
    ///   - hasUnsavedProgress: true once the person entered something leaving would lose.
    ///   - confirmTitle: the question; the library's "Leave without finishing?" when `nil`.
    ///   - confirmMessage: the consequence; the library's "What you've entered so far won't be kept." when `nil`.
    ///   - confirmLabel: the destructive verb; the library's "Leave" when `nil`.
    ///   - action: leaves the flow (dismisses it, or sends the screen's `exitTapped`).
    public init(
        _ accessibilityLabel: LocalizedStringKey? = nil,
        hasUnsavedProgress: Bool = false,
        confirmTitle: LocalizedStringKey? = nil,
        confirmMessage: LocalizedStringKey? = nil,
        confirmLabel: LocalizedStringKey? = nil,
        action: @escaping () -> Void
    ) {
        self.accessibilityLabel = accessibilityLabel
        self.hasUnsavedProgress = hasUnsavedProgress
        self.confirmTitle = confirmTitle.map { Text($0) } ?? Text("Leave without finishing?", bundle: .module)
        self.confirmMessage =
            confirmMessage.map { Text($0) } ?? Text("What you've entered so far won't be kept.", bundle: .module)
        self.confirmLabel = confirmLabel.map { Text($0) } ?? Text("Leave", bundle: .module)
        self.action = action
    }
}
