import KoboTokens
import SwiftUI

/// One row of a breakdown card: its label, the value its bar measures, the value as text, and the bar's colour.
public struct ChatBreakdownRow: Identifiable, Equatable {
    public let id: String
    public let label: String
    public let value: Double
    public let display: String
    public let tint: Color

    public init(id: String, label: String, value: Double, display: String, tint: Color) {
        self.id = id
        self.label = label
        self.value = value
        self.display = display
        self.tint = tint
    }
}

/// A total and its parts, inside a reply: a caption ("October 2026"), the total in large type with an optional unit,
/// then one row per part with its label, a bar (the longest part fills the track) and its value. A footer slot holds
/// the card's buttons (often two outlined ones side by side). On the calm `.chatCard()`.
///
///     ChatBreakdownCard(caption: "This week", total: "12 h 30 m", rows: rows) {
///         Button("Open") { open() }.buttonStyle(.kobo(.outlined, size: .compact, width: .full))
///     }
public struct ChatBreakdownCard<Footer: View>: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var bar = Space.sm
    private let caption: String
    private let total: String
    private let unit: String?
    private let rows: [ChatBreakdownRow]
    private let footer: Footer

    public init(
        caption: String,
        total: String,
        unit: String? = nil,
        rows: [ChatBreakdownRow],
        @ViewBuilder footer: () -> Footer
    ) {
        self.caption = caption
        self.total = total
        self.unit = unit
        self.rows = rows
        self.footer = footer()
    }

    public var body: some View {
        let fractions = ChatBreakdownLogic.fractions(rows.map(\.value))
        VStack(alignment: .leading, spacing: Space.lg) {
            VStack(alignment: .leading, spacing: Space.xxs) {
                Text(verbatim: caption)
                    .font(theme.font(.subheadline))
                    .foregroundStyle(theme.palette.textSecondary)
                HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                    Text(verbatim: total)
                        .font(theme.font(.largeTitle).weight(.semibold).monospacedDigit())
                        .foregroundStyle(theme.palette.textPrimary)
                    if let unit {
                        Text(verbatim: unit)
                            .font(theme.font(.subheadline))
                            .foregroundStyle(theme.palette.textSecondary)
                    }
                }
            }
            .accessibilityElement(children: .combine)
            Grid(alignment: .leading, horizontalSpacing: Space.md, verticalSpacing: Space.md) {
                ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                    GridRow {
                        Text(verbatim: row.label)
                            .font(theme.font(.subheadline))
                            .foregroundStyle(theme.palette.textPrimary)
                        ChatBreakdownBar(fraction: fractions[index], tint: row.tint, height: bar)
                        Text(verbatim: row.display)
                            .font(theme.font(.subheadline).monospacedDigit())
                            .foregroundStyle(theme.palette.textSecondary)
                            .gridColumnAlignment(.trailing)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(Text(verbatim: "\(row.label), \(row.display)"))
                }
            }
            footer
        }
        .chatCard()
        .accessibilityElement(children: .contain)
    }
}

extension ChatBreakdownCard where Footer == EmptyView {
    /// A breakdown with no buttons.
    public init(caption: String, total: String, unit: String? = nil, rows: [ChatBreakdownRow]) {
        self.init(caption: caption, total: total, unit: unit, rows: rows) { EmptyView() }
    }
}

/// A rounded bar on a light grey track; never shorter than its own height, so a small part still shows.
private struct ChatBreakdownBar: View {
    @Environment(\.koboTheme) private var theme
    let fraction: Double
    let tint: Color
    let height: CGFloat

    var body: some View {
        Capsule()
            .fill(theme.palette.surfaceRaised)
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .overlay(alignment: .leading) {
                GeometryReader { proxy in
                    Capsule()
                        .fill(tint)
                        .frame(width: fraction > 0 ? max(height, proxy.size.width * fraction) : 0)
                }
            }
            .accessibilityHidden(true)
    }
}

#if DEBUG
    private struct ChatBreakdownCardPreview: View {
        @Environment(\.koboTheme) private var theme

        var body: some View {
            ChatBreakdownCard(
                caption: "October 2026",
                total: "38 h 15 m",
                unit: "by project",
                rows: [
                    ChatBreakdownRow(id: "a", label: "Design", value: 960, display: "16 h", tint: theme.palette.accent),
                    ChatBreakdownRow(id: "b", label: "Writing", value: 690, display: "11 h 30 m", tint: theme.palette.info.ink),
                    ChatBreakdownRow(id: "c", label: "Calls", value: 465, display: "7 h 45 m", tint: theme.palette.success.ink),
                    ChatBreakdownRow(id: "d", label: "Admin", value: 180, display: "3 h", tint: theme.palette.textTertiary),
                ]
            ) {
                HStack(spacing: Space.sm) {
                    Button("Open") {}.buttonStyle(.kobo(.outlined, size: .compact, width: .full))
                    Button("Share") {}.buttonStyle(.kobo(.outlined, size: .compact, width: .full))
                }
            }
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Breakdown card") { ChatBreakdownCardPreview() }
    #Preview("Breakdown card · dark") { ChatBreakdownCardPreview().preferredColorScheme(.dark) }
    #Preview("Breakdown card · AX3") { ChatBreakdownCardPreview().dynamicTypeSize(.accessibility3) }
#endif
