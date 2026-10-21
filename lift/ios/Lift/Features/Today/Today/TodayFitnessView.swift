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
    let fitness: TodayFitness
    /// The touched day, shared by both charts. Presentation state only.
    @State private var selection: Date?

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            if let shown = shownDay { TodayFitnessNow(day: shown) }
            KoboLineChart(
                series: [
                    line("ctl", String(localized: "Fitness"), \.ctl, color: theme.palette.chartColor(0)),
                    line("atl", String(localized: "Fatigue"), \.atl, color: theme.palette.chartColor(1)),
                ].flatMap(\.self),
                markers: eventMarkers,
                height: .regular,
                selection: $selection,
                xText: dayText,
                accessibilityLabel: "Fitness and fatigue"
            )
            .yDomain(domain(fitness.days.flatMap { [$0.ctl, $0.atl] }))
            KoboLineChart(
                series: line("tsb", String(localized: "Form"), \.tsb, color: theme.palette.chartColor(2)),
                bands: bands,
                markers: todayMarker,
                height: .compact,
                selection: $selection,
                xText: dayText,
                accessibilityLabel: "Form"
            )
            .yDomain(domain(fitness.days.map(\.tsb)))
            if let caption {
                Text(verbatim: caption)
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .koboCard()
    }

    private var todayLabel: String { String(localized: "Today") }

    /// "Dashed lines are the plan." when there is a projection, then the server's caption.
    private var caption: String? {
        let dashed = fitness.days.contains(where: \.projected) ? String(localized: "Dashed lines are the plan.") : nil
        let text = [dashed, fitness.caption].compactMap(\.self).joined(separator: " ")
        return text.isEmpty ? nil : text
    }

    /// The header's day: the touched day, or the last measured day (`now`) when nothing is touched.
    private var shownDay: TodayFitnessDay? {
        if let selection, let touched = nearestDay(to: selection) {
            let plan = touched.projected ? " · " + String(localized: "plan") : ""
            return TodayFitnessDay(
                ctl: touched.ctl,
                atl: touched.atl,
                tsb: touched.tsb,
                zone: nil,
                label: (date(touched.date).map(dayText) ?? "") + plan
            )
        }
        return fitness.now.map { now in
            TodayFitnessDay(ctl: now.ctl, atl: now.atl, tsb: now.tsb, zone: now.zone, label: nil)
        }
    }

    private func nearestDay(to target: Date) -> FitnessDay? {
        fitness.days.min { lhs, rhs in
            abs((date(lhs.date) ?? .distantPast).timeIntervalSince(target))
                < abs((date(rhs.date) ?? .distantPast).timeIntervalSince(target))
        }
    }

    /// The data's range with a little room above and below, so no line is clipped.
    private func domain(_ values: [Double]) -> ClosedRange<Double> {
        guard let low = values.min(), let high = values.max() else { return 0...1 }
        let pad = max((high - low) * 0.08, 1)
        return (low - pad)...(high + pad)
    }

    private func date(_ day: PlainDay) -> Date? { day.day.startDate(in: calendar) }

    private func dayText(_ date: Date) -> String {
        date.formatted(Date.FormatStyle(calendar: calendar, timeZone: calendar.timeZone).month(.abbreviated).day())
    }

    /// The measured line and, when the plan projects ahead, its dashed continuation from the last measured day.
    private func line(_ id: String, _ name: String, _ value: KeyPath<FitnessDay, Double>, color: Color)
        -> [ChartSeries<Date>]
    {
        let points = { (days: [FitnessDay]) in
            days.compactMap { day in date(day.date).map { ChartPoint(x: $0, y: day[keyPath: value]) } }
        }
        let measured = fitness.days.filter { !$0.projected }
        let projected = (measured.last.map { [$0] } ?? []) + fitness.days.filter(\.projected)
        var series = [ChartSeries(id: id, name: name, points: points(measured), color: color)]
        if projected.count > 1 {
            // The same name: one legend item per metric; the caption says dashed lines are the plan.
            series.append(
                ChartSeries(id: "\(id)-plan", name: name, points: points(projected), color: color, stroke: .dashed)
            )
        }
        return series
    }

    /// Each event on the upper chart: A events named, B and C a quiet rule. Labels sit apart from Today's on the
    /// lower chart, so they never overlap.
    private var eventMarkers: [ChartMarker<Date>] {
        fitness.events.compactMap { event in
            date(event.date).map { ChartMarker(x: $0, label: event.priority == "A" ? event.name : "", tone: .info) }
        }
    }

    private var todayMarker: [ChartMarker<Date>] {
        date(fitness.today).map { [ChartMarker(x: $0, label: todayLabel, tone: .accent)] } ?? []
    }

    /// The shaded form zones; an open end stops just past the data.
    private var bands: [ChartBand] {
        let values = fitness.days.map(\.tsb)
        let low = (values.min() ?? -30) - 5
        let high = (values.max() ?? 20) + 5
        return fitness.zones.filter(\.shade).map { zone in
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
    let day: TodayFitnessDay

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            HStack(spacing: Space.lg) {
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
