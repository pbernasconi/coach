import KoboTokens
import SwiftUI

/// An icon-only button in a `SheetHeader`. The accessibility label is required.
public struct SheetHeaderAction {
    public var accessibilityLabel: Text
    public var isEnabled: Bool
    public var action: () -> Void

    public init(accessibilityLabel: LocalizedStringKey, isEnabled: Bool = true, action: @escaping () -> Void) {
        self.init(label: Text(accessibilityLabel), isEnabled: isEnabled, action: action)
    }

    /// An action whose accessibility label is shown as is, because it names user data ("Save Push day").
    public init(verbatimAccessibilityLabel: String, isEnabled: Bool = true, action: @escaping () -> Void) {
        self.init(label: Text(verbatim: verbatimAccessibilityLabel), isEnabled: isEnabled, action: action)
    }

    init(label: Text, isEnabled: Bool = true, action: @escaping () -> Void) {
        self.accessibilityLabel = label
        self.isEnabled = isEnabled
        self.action = action
    }
}

/// The header of an iOS 26 sheet, without a grabber: a glass circular close button, a centred title and
/// optional subtitle, and an optional prominent confirm (checkmark) button. Under a `.solid` theme the buttons are
/// flat circles (`KoboButtonStyle` `.secondary` and `.primary` at `.icon` size) instead of glass.
///
///     SheetHeader("Edit set", onClose: dismiss, confirm: SheetHeaderAction(accessibilityLabel: "Save", action: save))
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
            iconButton(close, systemImage: "xmark", prominent: false)
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
                iconButton(confirm, systemImage: "checkmark", prominent: true)
            } else {
                // Balances the close button so the title stays centred.
                iconButton(close, systemImage: "xmark", prominent: false)
                    .hidden()
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, Space.lg)
        .padding(.top, Space.lg)
        .padding(.bottom, Space.sm)
    }

    private func iconButton(_ item: SheetHeaderAction, systemImage: String, prominent: Bool) -> some View {
        let label = Image(systemName: systemImage)
            .accessibilityHidden(true)  // the button carries the label
            .font(theme.font(.body).weight(.semibold))
            .frame(width: buttonSize, height: buttonSize)
        return Button(action: item.action) { label }
            .modifier(SheetHeaderButtonLook(prominent: prominent))
            .disabled(!item.isEnabled)
            .accessibilityLabel(item.accessibilityLabel)
    }
}

/// Glass circles under a glass theme; flat Kobo circles under a solid one (glass yields to `.solid`, rule 16).
private struct SheetHeaderButtonLook: ViewModifier {
    @Environment(\.koboTheme) private var theme
    let prominent: Bool

    func body(content: Content) -> some View {
        switch (theme.surfaceStyle, prominent) {
        case (.glass, true): content.buttonStyle(.glassProminent).buttonBorderShape(.circle)
        case (.glass, false): content.buttonStyle(.glass).buttonBorderShape(.circle)
        case (.solid, true): content.buttonStyle(.kobo(.primary, size: .icon))
        case (.solid, false): content.buttonStyle(.kobo(.secondary, size: .icon))
        }
    }
}

#if DEBUG
    private struct SheetHeaderPreview: View {
        var body: some View {
            VStack(spacing: Space.xxl) {
                SheetHeader("Library", onClose: {})
                SheetHeader(
                    "Edit set",
                    subtitle: "Bench press · set 2",
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
                    .koboTheme(Theme(palette: .lift, surfaceStyle: .solid))
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
