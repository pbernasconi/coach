import KoboTokens
import SwiftUI

/// An icon-only button in a `SheetHeader`. The accessibility label is required. By default it is the prominent
/// checkmark (confirm); a `.destructive` role draws a quiet circle with a danger icon instead (a trash that deletes
/// the record the sheet edits).
///
///     SheetHeaderAction(accessibilityLabel: "Delete", systemImage: "trash", role: .destructive, action: delete)
public struct SheetHeaderAction {
    public var accessibilityLabel: Text
    public var systemImage: String
    public var role: ButtonRole?
    public var isEnabled: Bool
    public var action: () -> Void

    public init(
        accessibilityLabel: LocalizedStringKey,
        systemImage: String = "checkmark",
        role: ButtonRole? = nil,
        isEnabled: Bool = true,
        action: @escaping () -> Void
    ) {
        self.init(
            label: Text(accessibilityLabel),
            systemImage: systemImage,
            role: role,
            isEnabled: isEnabled,
            action: action
        )
    }

    /// An action whose accessibility label is shown as is, because it names user data ("Save Garden plan").
    public init(
        verbatimAccessibilityLabel: String,
        systemImage: String = "checkmark",
        role: ButtonRole? = nil,
        isEnabled: Bool = true,
        action: @escaping () -> Void
    ) {
        self.init(
            label: Text(verbatim: verbatimAccessibilityLabel),
            systemImage: systemImage,
            role: role,
            isEnabled: isEnabled,
            action: action
        )
    }

    init(
        label: Text,
        systemImage: String = "checkmark",
        role: ButtonRole? = nil,
        isEnabled: Bool = true,
        action: @escaping () -> Void
    ) {
        self.accessibilityLabel = label
        self.systemImage = systemImage
        self.role = role
        self.isEnabled = isEnabled
        self.action = action
    }

    var look: SheetHeaderButtonLook.Kind { role == .destructive ? .destructive : .prominent }
}

/// The header of an iOS 26 sheet, without a grabber: a glass circular close button, a centred title and
/// optional subtitle, and an optional trailing action: a prominent confirm (checkmark), or a destructive one (trash).
/// Under a `.solid` theme the buttons are flat circles (`KoboButtonStyle` at `.icon` size) instead of glass.
///
///     SheetHeader("Edit task", onClose: dismiss, confirm: SheetHeaderAction(accessibilityLabel: "Save", action: save))
public struct SheetHeader: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var buttonSize = Size.minTouch
    private let title: Text
    private let subtitle: Text?
    private let close: SheetHeaderAction
    private let confirm: SheetHeaderAction?

    /// - Parameter closeAccessibilityLabel: what VoiceOver calls the close button; the library's "Close" when `nil`.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        closeAccessibilityLabel: LocalizedStringKey? = nil,
        onClose: @escaping () -> Void,
        confirm: SheetHeaderAction? = nil
    ) {
        let subtitle = subtitle.map { Text($0) }
        let close = Self.closeAction(closeAccessibilityLabel, onClose: onClose)
        self.init(title: Text(title), subtitle: subtitle, close: close, confirm: confirm)
    }

    /// A header whose title and subtitle are shown as is (a record's name).
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        closeAccessibilityLabel: LocalizedStringKey? = nil,
        onClose: @escaping () -> Void,
        confirm: SheetHeaderAction? = nil
    ) {
        let subtitle = subtitle.map { Text(verbatim: $0) }
        let close = Self.closeAction(closeAccessibilityLabel, onClose: onClose)
        self.init(title: Text(verbatim: title), subtitle: subtitle, close: close, confirm: confirm)
    }

    /// The one place every initialiser lands: ready-made texts. Internal so other families (Overlays) can reuse the
    /// header with library-owned labels.
    init(title: Text, subtitle: Text?, close: SheetHeaderAction, confirm: SheetHeaderAction?) {
        self.title = title
        self.subtitle = subtitle
        self.close = close
        self.confirm = confirm
    }

    /// A header from ready-made texts, with an optional library-owned close label ("Cancel"); "Close" when `nil`.
    init(
        title: Text,
        subtitle: Text? = nil,
        closeLabel: Text?,
        onClose: @escaping () -> Void,
        confirm: SheetHeaderAction? = nil
    ) {
        let close = SheetHeaderAction(label: closeLabel ?? Text("Close", bundle: .module), action: onClose)
        self.init(title: title, subtitle: subtitle, close: close, confirm: confirm)
    }

    private static func closeAction(_ label: LocalizedStringKey?, onClose: @escaping () -> Void) -> SheetHeaderAction {
        SheetHeaderAction(label: label.map { Text($0) } ?? Text("Close", bundle: .module), action: onClose)
    }

    public var body: some View {
        HStack(alignment: .center, spacing: Space.sm) {
            iconButton(close, systemImage: "xmark", look: .plain)
            VStack(spacing: Space.xxs) {
                title
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                if let subtitle {
                    subtitle
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            if let confirm {
                iconButton(confirm, systemImage: confirm.systemImage, look: confirm.look)
            } else {
                // Balances the close button so the title stays centred.
                iconButton(close, systemImage: "xmark", look: .plain)
                    .hidden()
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, Space.lg)
        .padding(.top, Space.lg)
        .padding(.bottom, Space.sm)
    }

    private func iconButton(
        _ item: SheetHeaderAction,
        systemImage: String,
        look: SheetHeaderButtonLook.Kind
    ) -> some View {
        let label = Image(systemName: systemImage)
            .accessibilityHidden(true)  // the button carries the label
            .font(theme.font(.body).weight(.semibold))
            .frame(width: buttonSize, height: buttonSize)
        return Button(role: item.role, action: item.action) { label }
            .modifier(SheetHeaderButtonLook(kind: look))
            .disabled(!item.isEnabled)
            .accessibilityLabel(item.accessibilityLabel)
    }
}

/// Glass circles under a glass theme; flat Kobo circles under a solid one (glass yields to `.solid`, rule 16).
/// A destructive action is the plain glass circle with a danger icon, so it stays as quiet as the close button.
struct SheetHeaderButtonLook: ViewModifier {
    enum Kind { case plain, prominent, destructive }

    @Environment(\.koboTheme) private var theme
    let kind: Kind

    func body(content: Content) -> some View {
        switch (theme.surfaceStyle, kind) {
        case (.glass, .prominent): content.buttonStyle(.glassProminent).buttonBorderShape(.circle)
        case (.glass, .plain): content.buttonStyle(.glass).buttonBorderShape(.circle)
        case (.glass, .destructive):
            content.buttonStyle(.glass).buttonBorderShape(.circle)
                .tint(theme.palette.danger.ink).foregroundStyle(theme.palette.danger.ink)
        case (.solid, .prominent): content.buttonStyle(.kobo(.primary, size: .icon))
        case (.solid, .plain): content.buttonStyle(.kobo(.secondary, size: .icon))
        case (.solid, .destructive): content.buttonStyle(.kobo(.destructiveTonal, size: .icon))
        }
    }
}

#if DEBUG
    private struct SheetHeaderPreview: View {
        static let delete = SheetHeaderAction(accessibilityLabel: "Delete", systemImage: "trash", role: .destructive) {}

        var body: some View {
            VStack(spacing: Space.xxl) {
                SheetHeader("Library", onClose: {})
                SheetHeader(
                    "Edit task",
                    subtitle: "Book flights · step 2",
                    closeAccessibilityLabel: "Cancel",
                    onClose: {},
                    confirm: SheetHeaderAction(accessibilityLabel: "Save") {}
                )
                SheetHeader(
                    verbatim: "Pinned note",
                    onClose: {},
                    confirm: SheetHeaderAction(verbatimAccessibilityLabel: "Save Pinned note", isEnabled: false) {}
                )
                SheetHeader("Solid theme", onClose: {}, confirm: SheetHeaderAction(accessibilityLabel: "Save") {})
                    .koboTheme(Theme(palette: .amber, surfaceStyle: .solid))
                SheetHeader("Edit entry", onClose: {}, confirm: Self.delete)
                SheetHeader("Solid delete", onClose: {}, confirm: Self.delete)
                    .koboTheme(Theme(palette: .amber, surfaceStyle: .solid))
            }
            .frame(maxHeight: .infinity, alignment: .top)
            .background(Theme.system.palette.surface)
        }
    }

    #Preview("Light") { SheetHeaderPreview() }
    #Preview("Dark") { SheetHeaderPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { SheetHeaderPreview().dynamicTypeSize(.accessibility3) }
    #Preview("In a sheet") {
        Color.clear.sheet(isPresented: .constant(true)) {
            VStack {
                SheetHeader("Library", onClose: {})
                Spacer()
            }
            .presentationDetents([.medium, .large])
        }
    }
#endif
