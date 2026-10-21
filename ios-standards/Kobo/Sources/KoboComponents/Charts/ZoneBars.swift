import Foundation
import KoboTokens
import SwiftUI

/// One row of `ZoneBars`: a short name ("Z2"), an optional range ("120–140"), an amount and how to show it ("32 min").
public struct ZoneBarItem: Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let detail: String?
    public let amount: Double
    public let amountText: String
    public let color: Color?

    /// - Parameters:
    ///   - name: shown as is; also the id.
    ///   - amount: the row's share of the total comes from this.
    ///   - color: the bar; a cool-to-hot ramp by row when `nil`.
    public init(name: String, detail: String? = nil, amount: Double, amountText: String, color: Color? = nil) {
        self.id = name
        self.name = name
        self.detail = detail
        self.amount = amount
        self.amountText = amountText
        self.color = color
    }
}

/// How a total splits across ordered zones: a row per zone with its name, range, a bar scaled to the largest zone, the
/// amount and a whole percentage (the percentages add up to 100). Columns line up across rows; at accessibility sizes
/// each row stacks. Each row is one VoiceOver element ("Z2, 120–140, 32 min, 25%").
///
///     ZoneBars(items: [
///         ZoneBarItem(name: "Z1", detail: "< 120", amount: 600, amountText: "10 min"),
///         ZoneBarItem(name: "Z2", detail: "120–140", amount: 1_920, amountText: "32 min"),
///     ])
public struct ZoneBars: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .body) private var barHeight = Space.sm + Space.xxs
    @State private var widths: [Int: CGFloat] = [:]
    private let items: [ZoneBarItem]

    public init(items: [ZoneBarItem]) {
        self.items = items
    }

    public var body: some View {
        let percentages = ShareMath.percentages(items.map(\.amount))
        let fractions = ShareMath.fractions(items.map(\.amount))
        let top = fractions.max() ?? 0
        VStack(alignment: .leading, spacing: Space.sm) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                row(
                    item,
                    color: color(at: index),
                    share: top > 0 ? fractions[index] / top : 0,
                    percent: percentages[index]
                )
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(Text(verbatim: spoken(item, percent: percentages[index])))
            }
        }
        .collectsColumnWidths($widths)
    }

    @ViewBuilder
    private func row(_ item: ZoneBarItem, color: Color, share: Double, percent: Int) -> some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: Space.xxs) {
                Text(verbatim: [item.name, item.detail].compactMap(\.self).joined(separator: "  "))
                    .font(theme.font(.subheadline).weight(.semibold))
                bar(color: color, share: share)
                Text(verbatim: "\(item.amountText) · \(percent)%")
                    .font(theme.font(.numeric))
                    .foregroundStyle(theme.palette.textSecondary)
            }
        } else {
            HStack(spacing: Space.sm) {
                Text(verbatim: item.name)
                    .font(theme.font(.subheadline).weight(.semibold))
                    .tableColumn(0, width: widths[0], alignment: .leading)
                if items.contains(where: { $0.detail != nil }) {
                    Text(verbatim: item.detail ?? "")
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.palette.textSecondary)
                        .tableColumn(1, width: widths[1], alignment: .leading)
                }
                bar(color: color, share: share)
                Text(verbatim: item.amountText)
                    .font(theme.font(.subheadline).monospacedDigit())
                    .tableColumn(2, width: widths[2], alignment: .trailing)
                Text(verbatim: "\(percent)%")
                    .font(theme.font(.caption).monospacedDigit())
                    .foregroundStyle(theme.palette.textSecondary)
                    .tableColumn(3, width: widths[3], alignment: .trailing)
            }
        }
    }

    private func bar(color: Color, share: Double) -> some View {
        SpanLayout {
            Capsule().fill(theme.palette.surfaceSunken).span(0...1)
            Capsule().fill(color).opacity(share > 0 ? 1 : 0).span(0...min(max(share, 0), 1))
        }
        .frame(height: barHeight)
        .frame(maxWidth: .infinity)
        .koboAnimation(.state, value: share)
    }

    /// Cool to hot by position: the first rows calm, the last ones hot, spread over however many zones there are.
    private func color(at index: Int) -> Color {
        if let color = items[index].color { return color }
        let ramp = [
            theme.palette.neutral.ink, theme.palette.info.ink, theme.palette.success.ink, theme.palette.warning.ink,
            theme.palette.danger.ink,
        ]
        guard items.count > 1 else { return ramp[1] }
        let position = Double(index) / Double(items.count - 1) * Double(ramp.count - 1)
        return ramp[min(Int(position.rounded()), ramp.count - 1)]
    }

    private func spoken(_ item: ZoneBarItem, percent: Int) -> String {
        [item.name, item.detail, item.amountText, "\(percent)%"].compactMap(\.self).joined(separator: ", ")
    }
}

private struct ZoneBarsPreview: View {
    @Environment(\.koboTheme) private var theme

    var body: some View {
        ZoneBars(items: [
            ZoneBarItem(name: "Z1", detail: "< 120", amount: 600, amountText: "10 min"),
            ZoneBarItem(name: "Z2", detail: "120–140", amount: 1_920, amountText: "32 min"),
            ZoneBarItem(name: "Z3", detail: "140–155", amount: 900, amountText: "15 min"),
            ZoneBarItem(name: "Z4", detail: "155–170", amount: 420, amountText: "7 min"),
            ZoneBarItem(name: "Z5", detail: "> 170", amount: 60, amountText: "1 min"),
        ])
        .padding()
        .background(theme.palette.canvas)
    }
}

#if DEBUG
    #Preview("Zone bars") { ZoneBarsPreview() }
    #Preview("Zone bars, dark") { ZoneBarsPreview().preferredColorScheme(.dark) }
    #Preview("Zone bars, AX3") { ZoneBarsPreview().dynamicTypeSize(.accessibility3) }
#endif
