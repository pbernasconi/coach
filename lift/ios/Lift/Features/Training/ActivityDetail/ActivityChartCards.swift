import KoboComponents
import KoboTokens
import SwiftUI

/// Strava's chart cards: one small chart per main stream (pace or speed, heart rate, power, elevation), each with its
/// average; a tap opens that stream's full page. "All charts" opens every stream on one axis.
struct ActivityChartCards: View {
    let analysis: ActivityAnalysis
    let detail: ActivityDetail
    let send: (ActivityDetailAction) -> Void

    var body: some View {
        if let x = analysis.x, !analysis.streams.isEmpty {
            VStack(alignment: .leading, spacing: Space.md) {
                ForEach(cards, id: \.stream.key) { card in
                    ActivityChartCard(stream: card.stream, x: x, color: card.color) {
                        send(.panelTapped(card.panel))
                    }
                }
                ActivitySeeAll(verbatim: String(localized: "All charts")) { send(.panelTapped(.charts)) }
            }
        } else if let empty = analysis.emptyText {
            SectionState(verbatim: empty)
        }
    }

    @Environment(\.koboTheme) private var theme

    /// The main streams in the server's order, each with its colour (the full charts' colour) and its page.
    private var cards: [(stream: ActivityAnalysis.Stream, color: Color, panel: ActivityPanel)] {
        analysis.streams.enumerated().compactMap { index, stream in
            guard stream.overlayOf == nil, let panel = panel(for: stream.key) else { return nil }
            return (stream, ActivityStreamColor.color(stream.key, index: index, palette: theme.palette), panel)
        }
    }

    /// The page a stream opens: its own when the server sent that section, else all the charts.
    private func panel(for key: String) -> ActivityPanel? {
        switch key {
        case "pace", "speed": detail.paceBars != nil || detail.splits != nil ? .pace : .charts
        case "hr": detail.heartRate != nil ? .heartRate : .charts
        case "watts": detail.power != nil ? .power : .charts
        case "alt": .charts
        default: nil
        }
    }
}

/// One stream as a small card: the name, its average, a chevron, and the line on the time axis.
struct ActivityChartCard: View {
    let stream: ActivityAnalysis.Stream
    let x: ActivityAnalysis.Axes
    let color: Color
    let action: () -> Void
    @Environment(\.koboTheme) private var theme

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: Space.sm) {
                HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                    Text(verbatim: stream.label)
                        .font(theme.font(.headline))
                        .foregroundStyle(theme.palette.textPrimary)
                    Spacer(minLength: Space.sm)
                    if let avg = stream.avgText {
                        Text(verbatim: [String(localized: "avg"), avg, stream.unit].joined(separator: " "))
                            .font(theme.font(.subheadline).monospacedDigit())
                            .foregroundStyle(theme.palette.textSecondary)
                    }
                    Image(systemName: "chevron.right")
                        .font(theme.font(.footnote).weight(.semibold))
                        .foregroundStyle(theme.palette.textTertiary)
                        .accessibilityHidden(true)
                }
                ActivityStreamChart(stream: stream, x: x, color: color, height: .compact)
                    .allowsHitTesting(false)
            }
            .koboCard()
        }
        .buttonStyle(.pressFeedback(.scale, in: RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)))
    }
}

/// One stream as a line on the time axis: pace upside down, elevation filled.
struct ActivityStreamChart: View {
    let stream: ActivityAnalysis.Stream
    let x: ActivityAnalysis.Axes
    let color: Color
    var height: ChartHeight = .regular

    var body: some View {
        let points = zip(x.timeS, stream.values).compactMap { x, y in y.map { ChartPoint(x: x, y: $0) } }
        KoboLineChart(
            series: [
                ChartSeries(id: stream.key, name: stream.label, points: points, color: color, fillsArea: stream.area)
            ],
            yDirection: stream.invert ? .down : .up,
            height: height,
            xText: { ActivityAxisText.clock($0) },
            yText: { ActivityAxisText.stream($0, unit: stream.unit) },
            verbatimAccessibilityLabel: stream.label
        )
    }
}

/// Strava's splits: each kilometre's pace as a bar (longer is faster), with the climb at the end. "See all" opens
/// the table with GAP and heart rate.
struct ActivitySplitBars: View {
    let splits: ActivitySplits
    let onAll: () -> Void
    @Environment(\.koboTheme) private var theme

    var body: some View {
        let speeds = splits.rows.compactMap(\.speed)
        VStack(alignment: .leading, spacing: Space.xs) {
            Grid(alignment: .leading, horizontalSpacing: Space.md, verticalSpacing: Space.xs) {
                GridRow {
                    Text("Km")
                    Text("Pace")
                    Color.clear.frame(height: 1)
                    Text("Elev").gridColumnAlignment(.trailing)
                }
                .font(theme.font(.caption))
                .foregroundStyle(theme.palette.textSecondary)
                ForEach(splits.rows.prefix(Self.shown), id: \.index) { row in
                    GridRow {
                        Text(verbatim: row.label)
                        Text(verbatim: row.paceText).fontWeight(.semibold)
                        bar(SplitBarMath.fraction(row.speed, of: speeds))
                        Text(verbatim: row.elevText).foregroundStyle(theme.palette.textSecondary)
                    }
                    .font(theme.font(.subheadline).monospacedDigit())
                    .accessibilityElement(children: .combine)
                }
            }
            Separator()
            ActivitySeeAll(verbatim: String(localized: "See all"), value: "\(splits.rows.count)", action: onAll)
                .padding(.bottom, -Space.sm)
        }
        .koboCard()
    }

    /// Rows shown here; the full table has every split.
    static let shown = 10

    private func bar(_ fraction: Double?) -> some View {
        GeometryReader { proxy in
            Capsule()
                .fill(theme.palette.info.ink)
                .frame(width: proxy.size.width * (fraction ?? 0))
        }
        .frame(height: Space.md)
        .opacity(fraction == nil ? 0 : 1)
        .accessibilityHidden(true)
    }
}

/// How long a split's bar is: the slowest split gets 40 % of the width, the fastest all of it.
nonisolated enum SplitBarMath {
    static let shortest = 0.4

    /// `nil` without a speed; the full width when every split has the same speed.
    static func fraction(_ speed: Double?, of speeds: [Double]) -> Double? {
        guard let speed, let low = speeds.min(), let high = speeds.max() else { return nil }
        guard high > low else { return 1 }
        return shortest + (1 - shortest) * (speed - low) / (high - low)
    }
}

/// One colour per stream on every activity chart, as Strava: pace and speed blue, heart rate red, power green,
/// elevation grey; any other stream takes the chart colour of its place.
@MainActor enum ActivityStreamColor {
    static func color(_ key: String, index: Int, palette: Palette) -> Color {
        switch key {
        case "pace", "speed": palette.info.ink
        case "hr": palette.danger.ink
        case "watts": palette.success.ink
        case "alt": palette.textTertiary
        default: palette.chartColor(index)
        }
    }
}
