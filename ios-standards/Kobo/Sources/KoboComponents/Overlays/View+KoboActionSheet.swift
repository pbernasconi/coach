import KoboTokens
import SwiftUI

extension View {
    /// A sheet of tap-to-pick actions, sized to fit, with a grabber. A tap plays the selection haptic and closes the
    /// sheet; the chosen action runs only after the sheet has gone (`PendingSheetAction`), so it may present
    /// another modal. A swipe or a tap outside closes it without running anything.
    ///
    ///     .koboActionSheet(isPresented: $showsOptions, title: "Lower A") {
    ///         ActionSheetItem("Move to another day", systemImage: "calendar", action: pickDay)
    ///         ActionSheetItem("Push to next week", systemImage: "arrow.right.to.line", action: push)
    ///         ActionSheetItem("Change workout", systemImage: "arrow.triangle.2.circlepath", action: change)
    ///         ActionSheetItem("Remove", systemImage: "trash", role: .destructive, action: remove)
    ///     }
    ///
    /// - Parameter onDidClose: runs after the sheet has gone by any path, after a chosen action.
    public func koboActionSheet(
        isPresented: Binding<Bool>,
        title: LocalizedStringKey? = nil,
        message: LocalizedStringKey? = nil,
        onDidClose: (() -> Void)? = nil,
        @ActionSheetBuilder actions: () -> [ActionSheetItem]
    ) -> some View {
        modifier(
            ActionSheetPresenter(
                isPresented: isPresented,
                title: title.map { Text($0) },
                message: message.map { Text($0) },
                onDidClose: onDidClose,
                items: actions()
            )
        )
    }

    /// An action sheet whose title and message are shown as is (they name user data).
    public func koboActionSheet(
        isPresented: Binding<Bool>,
        verbatim title: String,
        message: String? = nil,
        onDidClose: (() -> Void)? = nil,
        @ActionSheetBuilder actions: () -> [ActionSheetItem]
    ) -> some View {
        modifier(
            ActionSheetPresenter(
                isPresented: isPresented,
                title: Text(verbatim: title),
                message: message.map { Text(verbatim: $0) },
                onDidClose: onDidClose,
                items: actions()
            )
        )
    }
}

private struct ActionSheetPresenter: ViewModifier {
    @State private var pending = PendingSheetAction<() -> Void>()
    @Binding var isPresented: Bool
    let title: Text?
    let message: Text?
    let onDidClose: (() -> Void)?
    let items: [ActionSheetItem]

    func body(content: Content) -> some View {
        content.sheet(isPresented: $isPresented, onDismiss: { pending.runAfterClose(then: onDidClose) }) {
            ActionSheetContent(title: title, message: message, items: items) { item in
                pending.choose(item.action)
                isPresented = false
            }
        }
    }
}

#if DEBUG
    private struct KoboActionSheetPreview: View {
        @Environment(\.koboTheme) private var theme
        @State private var isPresented = true
        @State private var result = "Nothing chosen"

        var body: some View {
            VStack(spacing: Space.lg) {
                Text(verbatim: result).foregroundStyle(theme.palette.textSecondary)
                Button("Workout options") { isPresented = true }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(theme.palette.canvas)
            .koboActionSheet(isPresented: $isPresented, title: "Lower A", message: "Planned for Tuesday") {
                ActionSheetItem("Move to another day", systemImage: "calendar") { result = "Move" }
                ActionSheetItem("Push to next week", systemImage: "arrow.right.to.line") { result = "Pushed" }
                ActionSheetItem("Change workout", systemImage: "arrow.triangle.2.circlepath", isEnabled: false) {}
                ActionSheetItem("Remove", systemImage: "trash", role: .destructive) { result = "Removed" }
            }
        }
    }

    #Preview("Light") { KoboActionSheetPreview() }
    #Preview("Dark") { KoboActionSheetPreview().preferredColorScheme(.dark) }
    #Preview("Lift") { KoboActionSheetPreview().koboTheme(.lift) }
    #Preview("AX3") { KoboActionSheetPreview().dynamicTypeSize(.accessibility3) }
#endif
