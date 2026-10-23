import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// The reading, as big as the screen allows, with the trend and its rate right under it.
struct WeighInHero: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .largeTitle) private var numberSize = WeighInHeroMetrics.number
    let weighIn: AppWeighIn
    let timeText: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Text(verbatim: WeighInText.heroLabel(timeText))
                .font(theme.font(.footnote).weight(.semibold))
                .foregroundStyle(theme.palette.textSecondary)
            HStack(alignment: .firstTextBaseline, spacing: Space.xs) {
                Text(verbatim: weighIn.weight.text)
                    .font(.system(size: numberSize, weight: .bold, design: .rounded).monospacedDigit())
                    .foregroundStyle(theme.palette.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(WeighInHeroMetrics.minimumScale)
                Text(verbatim: weighIn.weight.unit)
                    .font(theme.font(.title2))
                    .foregroundStyle(theme.palette.textSecondary)
            }
            if let trend = weighIn.trend {
                WeighInTrendLine(trend: trend, unit: weighIn.weight.unit)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// "▬ Trend 83.5 kg  ▼ 0.26 kg/wk": the key swatch of the chart's line, the trend, and the rate in its tone.
private struct WeighInTrendLine: View {
    @Environment(\.koboTheme) private var theme
    let trend: WeighInTrend
    let unit: String

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: Space.sm) { parts }
            VStack(alignment: .leading, spacing: Space.xxs) { parts }
        }
        .font(theme.font(.headline))
    }

    @ViewBuilder private var parts: some View {
        HStack(spacing: Space.sm) {
            WeighInSwatch()
            Text(verbatim: String(localized: "Trend \(trend.text) \(unit)"))
                .foregroundStyle(theme.palette.textPrimary)
                .monospacedDigit()
        }
        if let rate = trend.rate {
            Text(verbatim: rate.text)
                .foregroundStyle(theme.palette.status(rate.tone.kobo).ink)
                .monospacedDigit()
        }
    }
}

/// The trend line's colour as a short bar, so "Trend" reads as the chart's line.
struct WeighInSwatch: View {
    @Environment(\.koboTheme) private var theme

    var body: some View {
        Capsule()
            .fill(theme.palette.accent)
            .frame(width: Space.lg, height: WeighInHeroMetrics.swatch)
            .accessibilityHidden(true)
    }
}

/// The hero's sizes: a number about twice the Large Title (it scales with Dynamic Type, and shrinks to fit).
enum WeighInHeroMetrics {
    static let number: CGFloat = 76
    static let minimumScale: CGFloat = 0.5
    static let swatch: CGFloat = 3
}
