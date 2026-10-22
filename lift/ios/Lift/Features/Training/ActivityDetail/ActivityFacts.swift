import KoboComponents
import KoboTokens
import SwiftUI

/// The small facts at the end, one icon line each, as Strava: the weather, the gear, the device, and Garmin's night.
struct ActivityFacts: View {
    let detail: ActivityDetail
    @Environment(\.koboTheme) private var theme

    var body: some View {
        let lines = facts
        if !lines.isEmpty {
            VStack(alignment: .leading, spacing: Space.md) {
                ForEach(lines, id: \.symbol) { fact in
                    Label {
                        Text(verbatim: fact.text).foregroundStyle(theme.palette.textPrimary)
                    } icon: {
                        Image(systemName: fact.symbol)
                            .foregroundStyle(theme.palette.textSecondary)
                            .accessibilityHidden(true)
                    }
                    .font(theme.font(.subheadline))
                }
            }
            .koboCard()
        }
    }

    private var facts: [(symbol: String, text: String)] {
        var out: [(symbol: String, text: String)] = []
        if let weather = detail.weather?.value {
            let rows = weather.rows.map { "\($0.label) \($0.valueText)" }
            out.append(("cloud.sun", ([weather.headline] + rows).joined(separator: " · ")))
        }
        if let gear = detail.equipment?.value?.gear {
            let symbol = gear.label == "Bike" ? "bicycle" : "shoe"
            out.append((symbol, [gear.name, gear.distanceText].compactMap(\.self).joined(separator: " ")))
        }
        if let device = detail.equipment?.value?.device {
            out.append(("applewatch", device))
        }
        if let garmin = detail.coach?.value?.garmin, !garmin.rows.isEmpty {
            out.append(("bed.double", garmin.rows.map { "\($0.label) \($0.valueText)" }.joined(separator: " · ")))
        }
        return out
    }
}
