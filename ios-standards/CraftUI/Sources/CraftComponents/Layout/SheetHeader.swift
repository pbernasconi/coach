import CraftTokens
import SwiftUI

/// An icon-only button in a `SheetHeader`. The accessibility label is required.
public struct SheetHeaderAction {
    public var accessibilityLabel: String
    public var isEnabled: Bool
    public var action: () -> Void

    public init(accessibilityLabel: String, isEnabled: Bool = true, action: @escaping () -> Void) {
        self.accessibilityLabel = accessibilityLabel
        self.isEnabled = isEnabled
        self.action = action
    }
}

/// The header of an iOS 26 sheet, without a grabber: a glass circular close button, a centred title and
/// optional subtitle, and an optional prominent confirm (checkmark) button.
///
///     SheetHeader("Edit set", closeAccessibilityLabel: "Close", onClose: dismiss,
///                 confirm: SheetHeaderAction(accessibilityLabel: "Save", action: save))
public struct SheetHeader: View {
    @Environment(\.craftTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var buttonSize = Size.minTouch
    private let title: String
    private let subtitle: String?
    private let close: SheetHeaderAction
    private let confirm: SheetHeaderAction?

    public init(
        _ title: String, subtitle: String? = nil, closeAccessibilityLabel: String,
        onClose: @escaping () -> Void, confirm: SheetHeaderAction? = nil
    ) {
        self.title = title
        self.subtitle = subtitle
        self.close = SheetHeaderAction(accessibilityLabel: closeAccessibilityLabel, action: onClose)
        self.confirm = confirm
    }

    public var body: some View {
        HStack(alignment: .center, spacing: Space.sm) {
            iconButton(close, systemImage: "xmark", prominent: false)
            VStack(spacing: Space.xxs) {
                Text(title)
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                if let subtitle {
                    Text(subtitle)
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

    @ViewBuilder
    private func iconButton(_ item: SheetHeaderAction, systemImage: String, prominent: Bool) -> some View {
        let label = Image(systemName: systemImage)
            .font(theme.font(.body).weight(.semibold))
            .frame(width: buttonSize, height: buttonSize)
        if prominent {
            Button(action: item.action) { label }
                .buttonStyle(.glassProminent)
                .buttonBorderShape(.circle)
                .disabled(!item.isEnabled)
                .accessibilityLabel(Text(item.accessibilityLabel))
        } else {
            Button(action: item.action) { label }
                .buttonStyle(.glass)
                .buttonBorderShape(.circle)
                .disabled(!item.isEnabled)
                .accessibilityLabel(Text(item.accessibilityLabel))
        }
    }
}

#if DEBUG
private struct SheetHeaderPreview: View {
    var body: some View {
        VStack(spacing: Space.xxl) {
            SheetHeader("Library", closeAccessibilityLabel: "Close", onClose: {})
            SheetHeader(
                "Edit set", subtitle: "Bench press · set 2", closeAccessibilityLabel: "Cancel", onClose: {},
                confirm: SheetHeaderAction(accessibilityLabel: "Save") {}
            )
            SheetHeader(
                "Pinned note", closeAccessibilityLabel: "Close", onClose: {},
                confirm: SheetHeaderAction(accessibilityLabel: "Save", isEnabled: false) {}
            )
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
            SheetHeader("Library", closeAccessibilityLabel: "Close", onClose: {})
            Spacer()
        }
        .presentationDetents([.medium, .large])
    }
}
#endif
