import KoboComponents
import KoboTokens
import LiftCore
import LiftSync
import SwiftUI

/// The fitness chart as the web draws it: fitness (CTL) and fatigue (ATL) above, form (TSB) with its zones below, on
/// one shared x range and touch. Measured days are solid, the plan's projection dashed; a rule marks today and each
/// event (A events named). Every number comes from the server.
struct TodayFitnessView: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.calendar) private var calendar
    /// Worked out once per body (`TodayFitnessChart`), so a drag redoes no date maths.
    let chart: TodayFitnessChart
    /// The touched day, shared by both charts. Presentation state only.
    @State private var selection: Date?

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            if let shown = shownDay { TodayFitnessNow(day: shown) }
            KoboLineChart(
                series: line("ctl", String(localized: "Fitness"), \.ctl, color: theme.palette.chartColor(0))
                    + line("atl", String(localized: "Fatigue"), \.atl, color: theme.palette.chartColor(1)),
                markers: chart.events.map { ChartMarker(x: $0.date, label: $0.label, tone: .info) },
                height: .regular,
                selection: $selection,
                xText: dayText,
                accessibilityLabel: "Fitness and fatigue"
            )
            .yDomain(chart.upperDomain)
            KoboLineChart(
                series: line("tsb", String(localized: "Form"), \.tsb, color: theme.palette.chartColor(2)),
                bands: bands,
                markers: chart.today.map { [ChartMarker(x: $0, label: String(localized: "Today"), tone: .accent)] }
                    ?? [],
                height: .compact,
                selection: $selection,
                xText: dayText,
                accessibilityLabel: "Form"
            )
            .yDomain(chart.formDomain)
            if let caption {
                Text(verbatim: caption)
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .koboCard()
    }

    /// "Dashed lines are the plan." when there is a projection, then the server's caption.
    private var caption: String? {
        let dashed = chart.projected.isEmpty ? nil : String(localized: "Dashed lines are the plan.")
        let text = [dashed, chart.caption].compactMap(\.self).joined(separator: " ")
        return text.isEmpty ? nil : text
    }

    /// The header's day: the touched day, or the last measured day (`now`) when nothing is touched.
    private var shownDay: TodayFitnessDay? {
        if let selection, let touched = chart.nearest(to: selection) {
            let plan = touched.projected ? " · " + String(localized: "plan") : ""
            return TodayFitnessDay(
                ctl: touched.ctl,
                atl: touched.atl,
                tsb: touched.tsb,
                zone: nil,
                label: dayText(touched.date) + plan
            )
        }
        return chart.now.map { now in
            TodayFitnessDay(ctl: now.ctl, atl: now.atl, tsb: now.tsb, zone: now.zone, label: nil)
        }
    }

    private func dayText(_ date: Date) -> String {
        date.formatted(Date.FormatStyle(calendar: calendar, timeZone: calendar.timeZone).month(.abbreviated).day())
    }

    /// The measured line and, when the plan projects ahead, its dashed continuation (same name: one legend item).
    private func line(_ id: String, _ name: String, _ value: KeyPath<TodayFitnessChart.Day, Double>, color: Color)
        -> [ChartSeries<Date>]
    {
        let points = { (days: [TodayFitnessChart.Day]) in days.map { ChartPoint(x: $0.date, y: $0[keyPath: value]) } }
        var series = [ChartSeries(id: id, name: name, points: points(chart.measured), color: color)]
        if !chart.projected.isEmpty {
            series.append(
                ChartSeries(
                    id: "\(id)-plan",
                    name: name,
                    points: points(chart.projected),
                    color: color,
                    stroke: .dashed
                )
            )
        }
        return series
    }

    /// The shaded form zones; an open end stops at the edge of the form range.
    private var bands: [ChartBand] {
        let low = chart.formDomain.lowerBound
        let high = chart.formDomain.upperBound
        return chart.zones.filter(\.shade).map { zone in
            let from = zone.from ?? min(low, (zone.to ?? low) - 1)
            let to = zone.to ?? max(high, from + 1)
            return ChartBand(from...max(to, from), label: zone.label, tone: .info)
        }
    }
}

/// The numbers the header shows for one day.
struct TodayFitnessDay: Equatable {
    let ctl: Double
    let atl: Double
    let tsb: Double
    /// The form zone, for the last measured day only.
    let zone: String?
    /// The touched day ("Oct 24 · plan"), or nil for the last measured day.
    let label: String?
}

/// Fitness, fatigue and form for the touched day, or for the last measured day with its form zone.
private struct TodayFitnessNow: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var typeSize
    let day: TodayFitnessDay

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            // Three numbers and a pill do not fit one line at accessibility sizes: they stack there.
            let row =
                typeSize.isAccessibilitySize
                ? AnyLayout(VStackLayout(alignment: .leading, spacing: Space.sm))
                : AnyLayout(HStackLayout(spacing: Space.lg))
            row {
                value(String(localized: "Fitness"), day.ctl, signed: false)
                value(String(localized: "Fatigue"), day.atl, signed: false)
                value(String(localized: "Form"), day.tsb, signed: true)
                if let zone = day.zone {
                    StatusPill(verbatim: zone, tone: .info, symbol: "gauge.with.dots.needle.33percent")
                }
            }
            Text(verbatim: day.label ?? String(localized: "Last measured day"))
                .font(theme.font(.caption))
                .foregroundStyle(theme.palette.textTertiary)
        }
        .accessibilityElement(children: .combine)
    }

    /// Form shows its sign ("+10"), as the chip does.
    private func value(_ label: String, _ number: Double, signed: Bool) -> some View {
        let style = FloatingPointFormatStyle<Double>.number.precision(.fractionLength(0))
        return VStack(alignment: .leading, spacing: 0) {
            Text(verbatim: label)
                .font(theme.font(.caption))
                .foregroundStyle(theme.palette.textSecondary)
            Text(verbatim: number.formatted(signed ? style.sign(strategy: .always(includingZero: false)) : style))
                .font(theme.font(.headline).monospacedDigit())
                .foregroundStyle(theme.palette.textPrimary)
        }
    }
}
