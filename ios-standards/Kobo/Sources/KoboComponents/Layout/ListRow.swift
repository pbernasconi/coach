import KoboTokens
import SwiftUI

/// A list row: optional `leading` slot (icon, avatar), title, optional subtitle and value text, and a
/// `trailing` slot. A row with an `action` is one `Button` with a press highlight and, when it has no
/// trailing slot, a chevron. A row without an action reads as one VoiceOver element. The row pays its section's
/// `rowInset` (the page gutter when flat), and the press highlight fills the whole row inside a `ListSection` (edge to
/// edge when flat, clipped by the card when grouped); every tap shows it once, however quick (`ListRowButtonStyle`).
///
///     ListRow("Units", value: "km", action: openUnits) { Image(systemName: "ruler").accessibilityHidden(true) }
///
/// For a trailing slot with no leading one, pass `leading: { EmptyView() }`. Interactive trailing
/// controls (a `Toggle`) belong in rows without an action, so buttons never nest. Titles from user data use the
/// `verbatim:` initialisers; `value` is always shown as is.
public struct ListRow<Leading: View, Trailing: View>: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.listRowDensity) private var density
    @Environment(\.listSectionStyle) private var style
    @State private var leadingWidth: CGFloat = 0
    private let title: Text
    private let subtitle: Text?
    private let value: String?
    private let action: (() -> Void)?
    private let leading: Leading
    private let trailing: Trailing

    /// A static row with leading and trailing slots.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        value: String? = nil,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing
    ) {
        let subtitle = subtitle.map { Text($0) }
        self.init(
            title: Text(title),
            subtitle: subtitle,
            value: value,
            action: nil,
            leading: leading(),
            trailing: trailing()
        )
    }

    /// A tappable row with leading and trailing slots.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        value: String? = nil,
        action: @escaping () -> Void,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing
    ) {
        let subtitle = subtitle.map { Text($0) }
        self.init(
            title: Text(title),
            subtitle: subtitle,
            value: value,
            action: action,
            leading: leading(),
            trailing: trailing()
        )
    }

    /// The one place every initialiser lands: ready-made texts and built slots.
    init(
        title: Text,
        subtitle: Text?,
        value: String?,
        action: (() -> Void)?,
        leading: Leading,
        trailing: Trailing
    ) {
        self.title = title
        self.subtitle = subtitle
        self.value = value
        self.action = action
        self.leading = leading
        self.trailing = trailing
    }

    public var body: some View {
        if let action {
            Button(action: action) { row }
                .buttonStyle(ListRowButtonStyle())
        } else {
            row.accessibilityElement(children: .combine)
        }
    }

    private var hasLeading: Bool { Leading.self != EmptyView.self }
    private var showsChevron: Bool { action != nil && Trailing.self == EmptyView.self }
    private var stacksValue: Bool { dynamicTypeSize.isAccessibilitySize }
    private var separatorInset: CGFloat {
        style.separatorInset(leadingWidth: hasLeading ? leadingWidth + Space.md : 0)
    }

    private var row: some View {
        HStack(spacing: Space.md) {
            if hasLeading {
                leading
                    .foregroundStyle(theme.palette.accentText)
                    .onGeometryChange(for: CGFloat.self) { proxy in
                        proxy.size.width
                    } action: { width in
                        leadingWidth = width
                    }
            }
            texts
            if !stacksValue, let value { valueText(value) }
            trailing
            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(theme.font(.footnote).weight(.semibold))
                    .foregroundStyle(theme.palette.textTertiary)
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, style.rowInset)
        .padding(.vertical, density.verticalPadding)
        .frame(maxWidth: .infinity, minHeight: density.minHeight, alignment: .leading)
        .contentShape(Rectangle())
        .listSectionSeparator(leadingInset: separatorInset)
    }

    private var texts: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            title
                .font(theme.font(.body))
                .foregroundStyle(theme.palette.textPrimary)
            if let subtitle {
                subtitle
                    .font(theme.font(density == .compact ? .footnote : .subheadline))
                    .foregroundStyle(theme.palette.textSecondary)
            }
            if stacksValue, let value { valueText(value) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func valueText(_ value: String) -> some View {
        Text(verbatim: value)
            .font(theme.font(.body))
            .foregroundStyle(theme.palette.textSecondary)
            .multilineTextAlignment(stacksValue ? .leading : .trailing)
    }
}

extension ListRow where Trailing == EmptyView {
    /// A static row with a leading slot.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        value: String? = nil,
        @ViewBuilder leading: () -> Leading
    ) {
        self.init(title, subtitle: subtitle, value: value, leading: leading, trailing: { EmptyView() })
    }

    /// A tappable row with a leading slot and a chevron.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        value: String? = nil,
        action: @escaping () -> Void,
        @ViewBuilder leading: () -> Leading
    ) {
        self.init(
            title,
            subtitle: subtitle,
            value: value,
            action: action,
            leading: leading,
            trailing: { EmptyView() }
        )
    }
}

extension ListRow where Leading == EmptyView, Trailing == EmptyView {
    /// A static text row.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        value: String? = nil
    ) {
        self.init(
            title,
            subtitle: subtitle,
            value: value,
            leading: { EmptyView() },
            trailing: { EmptyView() }
        )
    }

    /// A tappable text row with a chevron.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        value: String? = nil,
        action: @escaping () -> Void
    ) {
        self.init(
            title,
            subtitle: subtitle,
            value: value,
            action: action,
            leading: { EmptyView() },
            trailing: { EmptyView() }
        )
    }
}

#if DEBUG
    private struct ListRowPreview: View {
        @State private var isOn = true

        var body: some View {
            ScrollView {
                ListSection("Rows") {
                    ListRow("Static title")
                    ListRow("With subtitle", subtitle: "A longer secondary line that wraps", value: "Value")
                    ListRow("Tappable", action: {})
                    ListRow(verbatim: "Book flights", subtitle: "Due Friday", value: "30 min", action: {})
                    ListRow("Leading icon", value: "km", action: {}) {
                        Image(systemName: "ruler").accessibilityHidden(true)
                    }
                    ListRow(verbatim: "Compact row", subtitle: "Footnote subtitle, less padding", action: {}) {
                        Thumbnail(systemName: "leaf", tone: .success, side: Size.iconLg + Space.lg)
                    }
                    .listRowDensity(.compact)
                    ListRow("Toggle trailing") {
                        EmptyView()
                    } trailing: {
                        Toggle("Toggle trailing", isOn: $isOn).labelsHidden()
                    }
                }
                .padding(.vertical, Space.gutter)
                .pageGutter()
            }
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("Light") { ListRowPreview() }
    #Preview("Dark") { ListRowPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { ListRowPreview().dynamicTypeSize(.accessibility3) }
#endif
