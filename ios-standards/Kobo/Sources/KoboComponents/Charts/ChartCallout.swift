import Foundation
import KoboTokens
import SwiftUI

/// The small card above a chart's crosshair: the touched x, then each series' colour, name and value.
struct ChartCallout: View {
    /// One line of the callout.
    struct Row: Hashable {
        let name: String
        let value: String
        let color: Color
    }

    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .caption) private var swatch = Space.sm
    let title: String
    let rows: [Row]

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            Text(verbatim: title)
                .font(theme.font(.caption).weight(.semibold))
                .foregroundStyle(theme.palette.textSecondary)
            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: Space.xs) {
                    Circle().fill(row.color).frame(width: swatch, height: swatch)
                    if rows.count > 1 {
                        Text(verbatim: row.name)
                            .foregroundStyle(theme.palette.textSecondary)
                    }
                    Text(verbatim: row.value)
                        .monospacedDigit()
                        .foregroundStyle(theme.palette.textPrimary)
                }
                .font(theme.font(.caption).weight(.semibold))
            }
        }
        .padding(.horizontal, Space.sm)
        .padding(.vertical, Space.xs)
        .background(theme.palette.surfaceRaised, in: RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radius.sm, style: .continuous)
                .strokeBorder(theme.palette.separator, lineWidth: Size.hairline)
        }
        .fixedSize()
        .accessibilityHidden(true)
    }
}
