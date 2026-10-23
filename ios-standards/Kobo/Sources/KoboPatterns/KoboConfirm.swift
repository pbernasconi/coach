import Foundation
import KoboComponents
import KoboTokens
import SwiftUI

/// The copy and action of a confirmation, in one shape for every app: a question as the title, an optional
/// consequence as the message, and a verb as the confirm button ("Delete", not "OK").
///
///     .koboConfirm(isPresented: $confirmingDelete, .destructive(
///         title: "Delete this project?", message: "Its tasks will be deleted too.",
///         confirmLabel: "Delete", perform: { send(.deleteConfirmed) }))
///
/// Copy is held as `Text`, like SwiftUI's own labels: literals localize from the app's bundle, and the `verbatim:`
/// initialisers show a title and message as is. Button labels stay localized in both.
public struct ConfirmationAction {
    /// Whether confirming destroys something; destructive confirms are drawn in red by the system.
    public enum Role: Sendable, Equatable {
        case standard, destructive
    }

    public var title: Text
    public var message: Text?
    public var confirmLabel: Text
    public var cancelLabel: Text?
    public var role: Role
    public var perform: () -> Void

    /// - Parameter cancelLabel: overrides the library's "Cancel" title.
    public init(
        title: LocalizedStringKey,
        message: LocalizedStringKey? = nil,
        confirmLabel: LocalizedStringKey,
        cancelLabel: LocalizedStringKey? = nil,
        role: Role = .standard,
        perform: @escaping () -> Void
    ) {
        self.init(
            texts: Text(title),
            message: message.map { Text($0) },
            confirmLabel: Text(confirmLabel),
            cancelLabel: cancelLabel.map { Text($0) },
            role: role,
            perform: perform
        )
    }

    /// A confirmation whose title and message are shown as is (they name user data).
    public init(
        verbatim title: String,
        message: String? = nil,
        confirmLabel: LocalizedStringKey,
        cancelLabel: LocalizedStringKey? = nil,
        role: Role = .standard,
        perform: @escaping () -> Void
    ) {
        self.init(
            texts: Text(verbatim: title),
            message: message.map { Text(verbatim: $0) },
            confirmLabel: Text(confirmLabel),
            cancelLabel: cancelLabel.map { Text($0) },
            role: role,
            perform: perform
        )
    }

    private init(
        texts title: Text,
        message: Text?,
        confirmLabel: Text,
        cancelLabel: Text?,
        role: Role,
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
        title: LocalizedStringKey,
        message: LocalizedStringKey? = nil,
        confirmLabel: LocalizedStringKey,
        cancelLabel: LocalizedStringKey? = nil,
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

    /// A confirmation that cannot be undone, whose title and message are shown as is.
    public static func destructive(
        verbatim title: String,
        message: String? = nil,
        confirmLabel: LocalizedStringKey,
        cancelLabel: LocalizedStringKey? = nil,
        perform: @escaping () -> Void
    ) -> ConfirmationAction {
        ConfirmationAction(
            verbatim: title,
            message: message,
            confirmLabel: confirmLabel,
            cancelLabel: cancelLabel,
            role: .destructive,
            perform: perform
        )
    }

    var buttonRole: ButtonRole? { role == .destructive ? .destructive : nil }
}

/// How a confirmation is shown.
public enum ConfirmationStyle: Sendable, Equatable {
    /// The system confirmation dialog. On iOS 26 it opens as a popover from the view it hangs on, and the popover
    /// leaves Cancel out (tapping outside cancels).
    case dialog
    /// A short bottom sheet: the title and message centred, then the confirm and cancel buttons stacked full width,
    /// confirm on top. Both buttons always show.
    case sheet
}

extension View {
    /// Shows a confirmation for `action` while `isPresented` is true. The title is always visible, the confirm button
    /// carries the destructive role when needed, and Cancel is always offered.
    @ViewBuilder
    public func koboConfirm(
        isPresented: Binding<Bool>,
        _ action: ConfirmationAction,
        style: ConfirmationStyle = .dialog
    ) -> some View {
        switch style {
        case .dialog: confirmDialog(isPresented: isPresented, action)
        case .sheet: sheet(isPresented: isPresented) { ConfirmationSheet(action: action, isPresented: isPresented) }
        }
    }

    private func confirmDialog(isPresented: Binding<Bool>, _ action: ConfirmationAction) -> some View {
        confirmationDialog(action.title, isPresented: isPresented, titleVisibility: .visible) {
            Button(role: action.buttonRole, action: action.perform) { action.confirmLabel }
            Button(role: .cancel) {
            } label: {
                action.cancelLabel ?? Text("Cancel", bundle: .module)
            }
        } message: {
            if let message = action.message {
                message
            }
        }
    }
}

#if DEBUG
    private struct KoboConfirmPreview: View {
        @State private var isPresented = true
        @State private var result = "Nothing confirmed"

        var body: some View {
            VStack(spacing: Space.lg) {
                Text(result)
                Button("Delete project", role: .destructive) { isPresented = true }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.system.palette.canvas)
            .koboConfirm(
                isPresented: $isPresented,
                .destructive(
                    title: "Delete this project?",
                    message: "Its tasks will be deleted too.",
                    confirmLabel: "Delete",
                    perform: { result = "Deleted" }
                )
            )
        }
    }

    #Preview("Light") { KoboConfirmPreview() }
    #Preview("Dark") { KoboConfirmPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { KoboConfirmPreview().dynamicTypeSize(.accessibility3) }
#endif
