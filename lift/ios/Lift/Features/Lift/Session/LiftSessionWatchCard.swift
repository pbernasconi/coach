import KoboComponents
import KoboTokens
import SwiftUI

/// The watch's recording of the lift on one card: average and max heart rate, the heart-rate line over the session, the
/// time in each zone as one bar, and the device. A tap opens the watch's full activity page.
struct LiftSessionWatchCard: View {
    @Environment(\.koboTheme) private var theme
    let watch: LiftWatch
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: Space.md) {
                HStack(alignment: .firstTextBaseline, spacing: Space.lg) {
                    WorkoutStatCell(label: String(localized: "Avg"), value: avg ?? "–", unit: "bpm", size: .compact)
                        .fixedSize()
                    WorkoutStatCell(label: String(localized: "Max"), value: max ?? "–", unit: "bpm", size: .compact)
                        .fixedSize()
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right")
                        .font(theme.font(.footnote).weight(.semibold))
                        .foregroundStyle(theme.palette.textTertiary)
                        .accessibilityHidden(true)
                }
                if let line = watch.heartRate {
                    LiftHeartRateLine(heartRate: line)
                        .allowsHitTesting(false)
                }
                if let zones = watch.zones, zones.contains(where: { $0.seconds > 0 }) {
                    LiftZoneStrip(zones: zones)
                }
                if let foot = footText {
                    Label(foot, systemImage: "applewatch")
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textTertiary)
                }
            }
            .koboCard()
        }
        .buttonStyle(.pressFeedback(.scale, in: RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)))
        .accessibilityHint(Text("Opens the watch activity"))
    }

    private var avg: String? { watch.heartRate?.avgText ?? stat("Avg Heart Rate") }
    private var max: String? { watch.heartRate?.maxText ?? stat("Max Heart Rate") }

    private func stat(_ label: String) -> String? {
        watch.stats.first { $0.label == label }?.valueText
    }

    /// The device, else the server's note (streams not in Coach yet).
    private var footText: String? {
        if watch.heartRate == nil, let note = watch.note { return note }
        return watch.deviceText
    }
}

/// The heart rate on the session's clock, in the heart-rate colour of the activity page.
private struct LiftHeartRateLine: View {
    @Environment(\.koboTheme) private var theme
    let heartRate: LiftWatch.HeartRate

    var body: some View {
        let points = zip(heartRate.timeS, heartRate.values).compactMap { x, y in y.map { ChartPoint(x: x, y: $0) } }
        KoboLineChart(
            series: [ChartSeries(id: "hr", name: "Heart rate", points: points, color: theme.palette.danger.ink)],
            height: .compact,
            xText: { ActivityAxisText.clock($0) },
            yText: { ActivityAxisText.stream($0, unit: "bpm") },
            verbatimAccessibilityLabel: String(localized: "Heart rate")
        )
    }
}

/// Time in each zone as one bar, Z1 to Z5 calm to hot, with the three largest zones under it.
private struct LiftZoneStrip: View {
    @Environment(\.koboTheme) private var theme
    let zones: [ActivityZones.Zone]

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            ProfileStrip(
                segments: zones.filter { $0.seconds > 0 }.map {
                    ProfileSegment(id: $0.zone, width: $0.seconds, start: 1, level: Swift.min(Swift.max($0.zone - 1, 0), 4))
                },
                height: Space.sm,
                verbatimAccessibilityLabel: String(localized: "Time in heart-rate zones: \(legend)")
            )
            .clipShape(Capsule())
            Text(verbatim: legend)
                .font(theme.font(.footnote).monospacedDigit())
                .foregroundStyle(theme.palette.textSecondary)
                .accessibilityHidden(true)
        }
    }

    /// "Z2 41% · Z3 30% · Z4 20%".
    private var legend: String {
        zones.sorted { $0.seconds > $1.seconds }.prefix(3).filter { $0.percent > 0 }
            .map { "Z\($0.zone) \($0.percent)%" }.joined(separator: " · ")
    }
}
