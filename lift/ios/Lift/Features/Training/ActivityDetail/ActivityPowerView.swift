import KoboComponents
import KoboTokens
import SwiftUI

/// Time in each zone, Z1 first, with the server's whole percentages.
struct ActivityZonesView: View {
    let zones: ActivityZones
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            ZoneBars(items: zones.zones.map(Self.item))
            if let note = zones.note {
                Text(verbatim: note).font(theme.font(.footnote)).foregroundStyle(theme.palette.textSecondary)
            }
        }
    }

    static func item(_ zone: ActivityZones.Zone) -> ZoneBarItem {
        ZoneBarItem(
            name: "Z\(zone.zone)",
            detail: "\(zone.name) · \(zone.rangeText)",
            amount: zone.seconds,
            amountText: zone.timeText,
            percent: zone.percent
        )
    }
}

/// The power curve on a log time axis with FTP marked, then the power zones.
struct ActivityPowerView: View {
    let power: ActivityPower

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            if power.curve.count > 1 {
                KoboLineChart(
                    series: [
                        ChartSeries(
                            id: "curve",
                            name: String(localized: "Best average"),
                            points: power.curve.map { ChartPoint(x: $0.seconds, y: $0.watts) },
                            showsPoints: true
                        )
                    ],
                    references: power.ftp.map { [ChartReference(y: $0, label: power.ftpText ?? "")] } ?? [],
                    xText: { ActivityAxisText.duration($0) },
                    yText: { "\(Int($0.rounded())) W" },
                    accessibilityLabel: "Power curve"
                )
                .logarithmicX(ticks: power.curve.map(\.seconds))
            }
            if !power.zones.isEmpty {
                ZoneBars(items: power.zones.map(ActivityZonesView.item))
            }
        }
    }
}
