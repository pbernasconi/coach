import KoboTokens
import SwiftUI

/// A quiet horizontal strip of label and value stats ("Sessions 3 · Time 2 h 40 · Volume 12 t") on the sunken fill,
/// with hairlines between them. Values use monospaced digits. At accessibility sizes the strip turns into rows, label
/// leading and value trailing. Each stat reads as one VoiceOver element: "Sessions, 3".
///
///     SummaryStrip([
///         .init("Sessions", value: "3"),
///         .init("Time", value: duration.formatted(.units(allowed: [.hours, .minutes]))),
///     ])
public struct SummaryStrip: View {
    /// One stat: a label and its formatted value.
    public struct Item {
        public let label: Text
        public let value: String

        /// A stat with a localized label; the value is shown as is.
        public init(_ label: LocalizedStringKey, value: String) {
            self.label = Text(label)
            self.value = value
        }

        /// A stat whose label is shown as is.
        public init(verbatim label: String, value: String) {
            self.label = Text(verbatim: label)
            self.value = value
        }
    }

    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private let items: [Item]

    public init(_ items: [Item]) {
        self.items = items
    }

    public var body: some View {
        let stacked = dynamicTypeSize.isAccessibilitySize
        let layout = stacked ? AnyLayout(VStackLayout(spacing: Space.sm)) : AnyLayout(HStackLayout(spacing: Space.md))
        layout {
            ForEach(Array(items.enumerated()), id: \.offset) { index, item in
                if index > 0 { divider(stacked: stacked) }
                stat(item, stacked: stacked)
            }
        }
        .padding(.horizontal, Space.md)
        .padding(.vertical, Space.sm)
        .frame(maxWidth: .infinity)
        .background(theme.palette.surfaceSunken, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
    }

    @ViewBuilder private func stat(_ item: Item, stacked: Bool) -> some View {
        let layout = stacked ? AnyLayout(HStackLayout()) : AnyLayout(VStackLayout(spacing: Space.xxs))
        layout {
            Text(verbatim: item.value)
                .font(theme.font(.headline))
                .foregroundStyle(theme.palette.textPrimary)
                .monospacedDigit()
            if stacked { Spacer(minLength: Space.sm) }
            item.label
                .font(theme.font(.caption))
                .foregroundStyle(theme.palette.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(item.label)
        .accessibilityValue(Text(verbatim: item.value))
    }

    @ViewBuilder private func divider(stacked: Bool) -> some View {
        if stacked {
            Separator()
        } else {
            Rectangle()
                .fill(theme.palette.separator)
                .frame(width: Size.hairline)
                .frame(maxHeight: .infinity)
                .accessibilityHidden(true)
        }
    }
}

#if DEBUG
    private struct SummaryStripPreview: View {
        var body: some View {
            VStack(spacing: Space.lg) {
                SummaryStrip([
                    .init("Sessions", value: "3"), .init("Time", value: "2 h 40"), .init("Volume", value: "12 t"),
                ])
                SummaryStrip([.init("Streak", value: "5 weeks"), .init(verbatim: "Best lift", value: "140 kg")])
            }
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Summary strip") { SummaryStripPreview() }
    #Preview("Summary strip · dark, Amber") { SummaryStripPreview().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Summary strip · AX3") { SummaryStripPreview().dynamicTypeSize(.accessibility3) }
#endif
