import KoboTokens
import SwiftUI

/// A full-height form page, presented full screen or as a large sheet (`.koboModalPage`): Cancel at the leading
/// edge, a primary confirm ("Save") at the trailing edge, an inline title with an optional subtitle, and scrolling
/// content in the screen gutter. With `hasChanges`, Cancel and the swipe down ask "Discard changes?" first.
///
///     ModalPage("New program", hasChanges: draft != .empty, isConfirmEnabled: draft.isValid, onConfirm: save) {
///         ListSection("Days") { … }
///     }
///
/// It owns a `NavigationStack`, so it can push detail pages; their Cancel is the system back button.
public struct ModalPage<Content: View>: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dismiss) private var dismiss
    @State private var closeGuard = UnsavedChangesGuard()
    private let title: OverlayTitle
    private let confirmLabel: Text
    private let isConfirmEnabled: Bool
    private let hasChanges: Bool
    private let closesOnConfirm: Bool
    private let onCancel: (() -> Void)?
    private let onConfirm: () -> Void
    private let content: Content

    /// - Parameters:
    ///   - confirmLabel: the confirm verb; the library's "Save" when `nil`.
    ///   - closesOnConfirm: false keeps the page open after `onConfirm` (an async save that closes it later).
    ///   - onCancel: what Cancel does once allowed; `nil` dismisses the page.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        confirmLabel: LocalizedStringKey? = nil,
        isConfirmEnabled: Bool = true,
        hasChanges: Bool = false,
        closesOnConfirm: Bool = true,
        onCancel: (() -> Void)? = nil,
        onConfirm: @escaping () -> Void,
        @ViewBuilder content: () -> Content
    ) {
        self.title = .localized(title, subtitle: subtitle)
        self.confirmLabel = confirmLabel.map { Text($0) } ?? Text("Save", bundle: .module)
        self.isConfirmEnabled = isConfirmEnabled
        self.hasChanges = hasChanges
        self.closesOnConfirm = closesOnConfirm
        self.onCancel = onCancel
        self.onConfirm = onConfirm
        self.content = content()
    }

    /// A page whose title and subtitle are shown as is (a record's name).
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        confirmLabel: LocalizedStringKey? = nil,
        isConfirmEnabled: Bool = true,
        hasChanges: Bool = false,
        closesOnConfirm: Bool = true,
        onCancel: (() -> Void)? = nil,
        onConfirm: @escaping () -> Void,
        @ViewBuilder content: () -> Content
    ) {
        self.title = .verbatim(title, subtitle: subtitle)
        self.confirmLabel = confirmLabel.map { Text($0) } ?? Text("Save", bundle: .module)
        self.isConfirmEnabled = isConfirmEnabled
        self.hasChanges = hasChanges
        self.closesOnConfirm = closesOnConfirm
        self.onCancel = onCancel
        self.onConfirm = onConfirm
        self.content = content()
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Space.lg) { content }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Space.gutter)
                    .padding(.vertical, Space.lg)
            }
            .scrollDismissesKeyboard(.interactively)
            .background { theme.palette.canvas.ignoresSafeArea() }
            .navigationTitle(title.title)
            .toolbarTitleDisplayMode(.inline)
            .toolbar { toolbar }
        }
        .interactiveDismissDisabled(hasChanges)
        .discardChangesDialog(isPresented: $closeGuard.isConfirmingDiscard) {
            closeGuard.confirmationAnswered()
            close()
        }
    }

    @ToolbarContentBuilder private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .principal) {
            ModalPageTitles(title: title.title, subtitle: title.subtitle)
        }
        ToolbarItem(placement: .cancellationAction) {
            Button(action: requestCancel) { Text("Cancel", bundle: .module) }
        }
        ToolbarItem(placement: .confirmationAction) {
            Button(action: confirm) { confirmLabel.fontWeight(.semibold) }
                .disabled(!isConfirmEnabled)
        }
    }

    private func requestCancel() {
        if closeGuard.requestClose(hasChanges: hasChanges) { close() }
    }

    private func confirm() {
        onConfirm()
        if closesOnConfirm { dismiss() }
    }

    private func close() {
        if let onCancel { onCancel() } else { dismiss() }
    }
}

/// The title and optional subtitle in the bar, one line each, read as one heading. The navigation title
/// stays set for the back button of pushed pages and for the system.
private struct ModalPageTitles: View {
    @Environment(\.koboTheme) private var theme
    let title: Text
    let subtitle: Text?

    var body: some View {
        VStack(spacing: Space.xxs) {
            title
                .font(theme.font(.headline))
                .foregroundStyle(theme.palette.textPrimary)
            if let subtitle {
                subtitle
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textSecondary)
            }
        }
        .lineLimit(1)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}
