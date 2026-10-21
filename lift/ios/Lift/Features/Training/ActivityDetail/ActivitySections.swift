import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// The activity page's sections in the web's order. A section the activity does not have is hidden; one the server
/// could not load shows its own line, and the rest still show.
struct ActivitySections: View {
    let detail: ActivityDetail
    let state: ActivityDetailState
    let send: (ActivityDetailAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            OptionalSection(nil, detail.header) { ActivityHeaderView(header: $0, send: send) }
            OptionalSection(nil, detail.overview) { ActivityOverviewView(overview: $0) }
            OptionalSection("Weather", detail.weather) { ActivityWeatherView(weather: $0) }
            OptionalSection("Equipment", detail.equipment) { ActivityEquipmentView(equipment: $0) }
            OptionalSection("Splits", detail.splits) { ActivitySplitsTable(splits: $0) }
            OptionalSection("Route", detail.route) { route in
                KoboRouteMap(points: route.coordinates, accessibilityLabel: "Route map") { send(.mapExpandTapped) }
            }
            OptionalSection(nil, detail.sameRoute) { ActivitySameRouteView(sameRoute: $0, send: send) }
            OptionalSection("Coach's view", detail.coach) { ActivityCoachView(coach: $0) }
            OptionalSection("Analysis", detail.analysis) { analysis in
                ActivityAnalysisView(analysis: analysis, axis: state.axis, send: send)
            }
            OptionalSection(nil, detail.paceBars) { bars in
                ActivityPaceBarsView(bars: bars, mode: state.paceMode, send: send)
            }
            OptionalSection("Pace distribution", detail.paceHistogram) { ActivityPaceHistogramView(histogram: $0) }
            OptionalSection("Relative effort", detail.relativeEffort) { ActivityEffortView(effort: $0) }
            OptionalSection("Heart rate zones", detail.heartRate) { ActivityZonesView(zones: $0) }
            OptionalSection("Power", detail.power) { ActivityPowerView(power: $0) }
            OptionalSection("Laps", detail.laps) { ActivityLapsTable(laps: $0) }
            OptionalSection("Best efforts", detail.bestEfforts) { ActivityBestEffortsTable(efforts: $0) }
            OptionalSection("Segments", detail.segments) { ActivitySegmentsTable(segments: $0) }
        }
    }
}

/// A section the activity may not have: hidden when `nil`, else `AppSectionView`.
struct OptionalSection<Value: Decodable & Equatable & Sendable, Content: View>: View {
    private let title: LocalizedStringKey?
    private let section: AppSection<Value>?
    private let content: (Value) -> Content

    init(
        _ title: LocalizedStringKey?,
        _ section: AppSection<Value>?,
        @ViewBuilder content: @escaping (Value) -> Content
    ) {
        self.title = title
        self.section = section
        self.content = content
    }

    var body: some View {
        if let section {
            AppSectionView(title, section: section, content: content)
        }
    }
}

/// The stat tiles: the big ones two to a row, then the small ones as a list, then PRs and kudos.
struct ActivityOverviewView: View {
    let overview: ActivityOverview
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            TileGrid(items: overview.big) { stat in
                StatTile(verbatim: stat.label, value: stat.valueText, unit: stat.unit)
            }
            if !overview.small.isEmpty {
                ListSection {
                    ForEach(overview.small, id: \.label) { stat in
                        KeyValueRow(
                            verbatim: stat.label,
                            value: [stat.valueText, stat.unit].compactMap(\.self).joined(separator: " ")
                        )
                    }
                }
            }
            if let achievements = overview.achievementsText {
                Label {
                    Text(verbatim: achievements)
                } icon: {
                    Image(systemName: "trophy").accessibilityHidden(true)
                }
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textSecondary)
            }
        }
    }
}

struct ActivityWeatherView: View {
    let weather: ActivityWeather

    var body: some View {
        ListSection {
            KeyValueRow(verbatim: String(localized: "Conditions"), value: weather.headline)
            ForEach(weather.rows, id: \.label) { row in KeyValueRow(verbatim: row.label, value: row.valueText) }
        } header: {
            EmptyView()
        } footer: {
            if let source = weather.source { Text(verbatim: source) }
        }
    }
}

struct ActivityEquipmentView: View {
    let equipment: ActivityEquipment

    var body: some View {
        ListSection {
            if let device = equipment.device {
                KeyValueRow(verbatim: String(localized: "Device"), value: device)
            }
            if let gear = equipment.gear {
                KeyValueRow(
                    verbatim: gear.label,
                    value: [gear.name, gear.distanceText].compactMap(\.self).joined(separator: " ")
                )
            }
        }
    }
}

/// Relative effort, TRIMP and TSS as tiles.
struct ActivityEffortView: View {
    let effort: ActivityRelativeEffort

    var body: some View {
        TileGrid(items: effort.stats) { stat in StatTile(verbatim: stat.label, value: stat.valueText) }
    }
}
