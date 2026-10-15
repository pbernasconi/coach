import Foundation

/// An action chosen inside a sheet, held until the sheet has finished closing. iOS cannot present another modal
/// (a confirmation, a second sheet, a full-screen page) while a sheet is still animating away, so "Change project"
/// in an action sheet must wait for the sheet's `onDismiss` before it opens the next screen.
///
///     @State private var pending = PendingSheetAction<() -> Void>()
///
///     .sheet(isPresented: $isOpen, onDismiss: { pending.runAfterClose() }) {
///         Button("Change project") { pending.choose(openPicker); isOpen = false }
///     }
///
/// It is a plain value: any `Action` works, so tests can hold an enum instead of a closure.
nonisolated public struct PendingSheetAction<Action> {
    /// The action waiting for the sheet to close, if any.
    public private(set) var pending: Action?

    public init() {}

    /// True while an action waits for the sheet to close.
    public var isWaiting: Bool { pending != nil }

    /// A choice in the sheet: keep `action` and run nothing yet. A later choice replaces an earlier one.
    public mutating func choose(_ action: Action) {
        pending = action
    }

    /// Forgets the chosen action, for a sheet that was reopened before it closed.
    public mutating func cancel() {
        pending = nil
    }

    /// The sheet is gone: hands back the chosen action once, and clears it.
    public mutating func sheetDidClose() -> Action? {
        defer { pending = nil }
        return pending
    }
}

extension PendingSheetAction: Sendable where Action: Sendable {}
extension PendingSheetAction: Equatable where Action: Equatable {}

extension PendingSheetAction where Action == () -> Void {
    /// The sheet is gone: runs the chosen action once, then `onDidClose`.
    public mutating func runAfterClose(then onDidClose: (() -> Void)? = nil) {
        let chosen = sheetDidClose()
        chosen?()
        onDidClose?()
    }
}
