import CraftTokens
import SwiftUI

/// A list row: optional `leading` slot (icon, avatar), title, optional subtitle and value text, and a
/// `trailing` slot. A row with an `action` is one `Button` with a press highlight and, when it has no
/// trailing slot, a chevron. A row without an action reads as one VoiceOver element.
///
///     ListRow("Units", value: "kg", action: openUnits) { Image(systemName: "scalemass").accessibilityHidden(true) }
///
/// For a trailing slot with no leading one, pass `leading: { EmptyView() }`. Interactive trailing
/// controls (a `Toggle`) belong in rows without an action, so buttons never nest.
public struct ListRow<Leading: View, Trailing: View>: View {
    @Environment(\.craftTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var leadingWidth: CGFloat = 0
    private let title: String
    private let subtitle: String?
    private let value: String?
    private let action: (() -> Void)?
    private let leading: Leading
    private let trailing: Trailing

    /// A static row with leading and trailing slots.
    public init(
        _ title: String,
        subtitle: String? = nil,
        value: String? = nil,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.title = title
        self.subtitle = subtitle
        self.value = value
        self.action = nil
        self.leading = leading()
        self.trailing = trailing()
    }

    /// A tappable row with leading and trailing slots.
    public init(
        _ title: String,
        subtitle: String? = nil,
        value: String? = nil,
        action: @escaping () -> Void,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.title = title
        self.subtitle = subtitle
        self.value = value
        self.action = action
        self.leading = leading()
        self.trailing = trailing()
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
    private var separatorInset: CGFloat { Space.lg + (hasLeading ? leadingWidth + Space.md : 0) }

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
        .padding(.horizontal, Space.lg)
        .padding(.vertical, Space.rowVertical)
        .frame(maxWidth: .infinity, minHeight: Size.rowMinHeight, alignment: .leading)
        .contentShape(Rectangle())
        .listSectionSeparator(leadingInset: separatorInset)
    }

    private var texts: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            Text(title)
                .font(theme.font(.body))
                .foregroundStyle(theme.palette.textPrimary)
            if let subtitle {
                Text(subtitle)
                    .font(theme.font(.subheadline))
                    .foregroundStyle(theme.palette.textSecondary)
            }
            if stacksValue, let value { valueText(value) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func valueText(_ value: String) -> some View {
        Text(value)
            .font(theme.font(.body))
            .foregroundStyle(theme.palette.textSecondary)
            .multilineTextAlignment(stacksValue ? .leading : .trailing)
    }
}

extension ListRow where Trailing == EmptyView {
    /// A static row with a leading slot.
    public init(_ title: String, subtitle: String? = nil, value: String? = nil, @ViewBuilder leading: () -> Leading) {
        self.init(title, subtitle: subtitle, value: value, leading: leading, trailing: { EmptyView() })
    }

    /// A tappable row with a leading slot and a chevron.
    public init(
        _ title: String,
        subtitle: String? = nil,
        value: String? = nil,
        action: @escaping () -> Void,
        @ViewBuilder leading: () -> Leading
    ) {
        self.init(title, subtitle: subtitle, value: value, action: action, leading: leading, trailing: { EmptyView() })
    }
}

extension ListRow where Leading == EmptyView, Trailing == EmptyView {
    /// A static text row.
    public init(_ title: String, subtitle: String? = nil, value: String? = nil) {
        self.init(title, subtitle: subtitle, value: value, leading: { EmptyView() }, trailing: { EmptyView() })
    }

    /// A tappable text row with a chevron.
    public init(_ title: String, subtitle: String? = nil, value: String? = nil, action: @escaping () -> Void) {
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

/// The pressed fill of a tappable row: in on `Motion.instant`, out on the faster-feeling `Motion.exit`.
private struct ListRowButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        ListRowPressLook(label: configuration.label, isPressed: configuration.isPressed)
    }
}

private struct ListRowPressLook<Label: View>: View {
    @Environment(\.craftTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let label: Label
    let isPressed: Bool

    var body: some View {
        label
            .foregroundStyle(theme.palette.textPrimary)
            .background(isPressed ? theme.palette.surfaceRaised : Color.clear)
            .animation(
                (isPressed ? Motion.instant : Motion.exit).animation(reduceMotion: reduceMotion),
                value: isPressed
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
                    ListRow("Leading icon", value: "kg", action: {}) {
                        Image(systemName: "scalemass").accessibilityHidden(true)
                    }
                    ListRow("Toggle trailing") {
                        EmptyView()
                    } trailing: {
                        Toggle("Toggle trailing", isOn: $isOn).labelsHidden()
                    }
                }
                .padding(Space.gutter)
            }
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("Light") { ListRowPreview() }
    #Preview("Dark") { ListRowPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { ListRowPreview().dynamicTypeSize(.accessibility3) }
#endif
