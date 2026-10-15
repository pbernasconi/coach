import CraftTokens
import Foundation
import SwiftUI

/// The copy and action of a confirmation, in one shape for every app: a question as the title, an optional
/// consequence as the message, and a verb as the confirm button ("Delete", not "OK").
///
///     .craftConfirm(isPresented: $confirmingDelete, .destructive(
///         title: "Delete this workout?", message: "Its sets will be removed from your history.",
///         confirmLabel: "Delete", perform: { send(.deleteConfirmed) }))
public struct ConfirmationAction {
    /// Whether confirming destroys something; destructive confirms are drawn in red by the system.
    public enum Role: Sendable, Equatable {
        case standard, destructive
    }

    public var title: String
    public var message: String?
    public var confirmLabel: String
    public var cancelLabel: String?
    public var role: Role
    public var perform: () -> Void

    /// - Parameter cancelLabel: overrides the system "Cancel" title.
    public init(
        title: String,
        message: String? = nil,
        confirmLabel: String,
        cancelLabel: String? = nil,
        role: Role = .standard,
        perform: @escaping () -> Void
    ) {
        self.title = title
        self.message = message
        self.confirmLabel = confirmLabel
        self.cancelLabel = cancelLabel
        self.role = role
        self.perform = perform
    }

    /// A confirmation whose action cannot be undone.
    public static func destructive(
        title: String,
        message: String? = nil,
        confirmLabel: String,
        cancelLabel: String? = nil,
        perform: @escaping () -> Void
    ) -> ConfirmationAction {
        ConfirmationAction(
            title: title,
            message: message,
            confirmLabel: confirmLabel,
            cancelLabel: cancelLabel,
            role: .destructive,
            perform: perform
        )
    }

    var buttonRole: ButtonRole? { role == .destructive ? .destructive : nil }
}

extension View {
    /// Shows a system confirmation dialog for `action` while `isPresented` is true. The title is always
    /// visible, the confirm button carries the destructive role when needed, and Cancel is always present.
    public func craftConfirm(isPresented: Binding<Bool>, _ action: ConfirmationAction) -> some View {
        confirmationDialog(action.title, isPresented: isPresented, titleVisibility: .visible) {
            Button(action.confirmLabel, role: action.buttonRole, action: action.perform)
            Button(action.cancelLabel ?? String(localized: "Cancel"), role: .cancel) {}
        } message: {
            if let message = action.message {
                Text(message)
            }
        }
    }
}

#if DEBUG
    private struct CraftConfirmPreview: View {
        @State private var isPresented = true
        @State private var result = "Nothing confirmed"

        var body: some View {
            VStack(spacing: Space.lg) {
                Text(result)
                Button("Delete workout", role: .destructive) { isPresented = true }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.system.palette.canvas)
            .craftConfirm(
                isPresented: $isPresented,
                .destructive(
                    title: "Delete this workout?",
                    message: "Its sets will be removed from your history.",
                    confirmLabel: "Delete",
                    perform: { result = "Deleted" }
                )
            )
        }
    }

    #Preview("Light") { CraftConfirmPreview() }
    #Preview("Dark") { CraftConfirmPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { CraftConfirmPreview().dynamicTypeSize(.accessibility3) }
#endif
