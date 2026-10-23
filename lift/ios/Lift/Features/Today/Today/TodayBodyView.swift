import KoboComponents
import KoboPatterns
import KoboTokens
import LiftSync
import SwiftUI

/// The latest weight with the trend's rate and 12-week trend line (the weigh-in screen's format), and body fat.
struct TodayBodyView: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var typeSize
    let reading: TodayBody

    var body: some View {
        if let weight = reading.weight {
            let layout =
                typeSize.isAccessibilitySize
                ? AnyLayout(VStackLayout(alignment: .leading, spacing: Space.sm))
                : AnyLayout(HStackLayout(alignment: .top, spacing: Space.sm))
            layout {
                StatTile(verbatim: String(localized: "Weight"), value: weight.text, unit: weight.unit) {
                    if let change = weight.changeText {
                        StatusPill(verbatim: change, tone: weight.changeTone?.kobo ?? .neutral, symbol: "scalemass")
                    }
                    if let note = weight.noteText {
                        Text(verbatim: note)
                            .font(theme.font(.caption))
                            .foregroundStyle(theme.palette.textSecondary)
                    }
                    Sparkline(
                        values: reading.series.map { $0.trendKg ?? $0.kg },
                        style: .area,
                        format: { $0.formatted(.number.precision(.fractionLength(1))) },
                        accessibilityLabel: "Weight trend, last 12 weeks"
                    )
                }
                .layoutPriority(1)
                StatTile(verbatim: String(localized: "Body fat"), value: reading.bodyFatText ?? "–")
            }
        } else {
            SectionEmptyCard(
                verbatim: reading.emptyText ?? String(localized: "No weight yet"),
                systemImage: "scalemass"
            )
        }
    }
}
