import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// Dumb view: one day's weigh-in, what it changed, the 12-week line and the weigh-ins either side (SCR-2).
struct WeighInContent: View {
    let state: WeighInState
    let send: (WeighInAction) -> Void

    var body: some View {
        ScrollView {
            AppResourcePage(
                state.weighIn,
                onRetry: { send(.retryTapped) },
                onConnect: { send(.connectTapped) }
            ) { weighIn in
                WeighInSections(weighIn: weighIn, neighbours: state.neighbours, send: send)
            }
            .pageColumn()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .navigationTitle(Text(verbatim: state.weighIn.content.value?.dateText ?? String(localized: "Weigh-in")))
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// The weight and body fat, the changes, the trend, then the neighbouring days.
private struct WeighInSections: View {
    @Environment(\.koboTheme) private var theme
    let weighIn: AppWeighIn
    let neighbours: [WeighInNeighbour]
    let send: (WeighInAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            TileGrid(WeighInTile.tiles(weighIn)) { tile in
                StatTile(verbatim: tile.label, value: tile.value, unit: tile.unit)
            }
            if !weighIn.changes.isEmpty {
                ListSection {
                    ForEach(weighIn.changes) { change in
                        KeyValueRow(verbatim: change.label, value: change.text, valueTone: change.tone.kobo)
                    }
                }
            }
            if weighIn.series.count > 1 {
                CardSection("Last 12 weeks") {
                    Sparkline(
                        values: weighIn.series.map(\.kg),
                        style: .area,
                        format: { $0.formatted(.number.precision(.fractionLength(1))) },
                        accessibilityLabel: "Weight, last 12 weeks"
                    )
                }
            }
            WeighInNeighbours(neighbours: neighbours, send: send)
            if let source = WeighInText.source(weighIn.source) {
                Text(verbatim: source)
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textSecondary)
            }
        }
    }
}

/// The earlier and the later weigh-in, when there are any.
private struct WeighInNeighbours: View {
    let neighbours: [WeighInNeighbour]
    let send: (WeighInAction) -> Void

    var body: some View {
        if !neighbours.isEmpty {
            ListSection {
                ForEach(neighbours) { row in
                    switch row.side {
                    case .earlier:
                        ListRow("Earlier weigh-in", value: row.dayText, action: { send(.dayTapped(row.day)) })
                    case .later:
                        ListRow("Later weigh-in", value: row.dayText, action: { send(.dayTapped(row.day)) })
                    }
                }
            }
        }
    }
}

/// One stat tile of the screen.
nonisolated struct WeighInTile: Identifiable, Equatable, Sendable {
    let id: String
    let label: String
    let value: String
    let unit: String?

    /// The weight, then body fat when the scale measured it.
    static func tiles(_ weighIn: AppWeighIn) -> [WeighInTile] {
        let weight = WeighInTile(
            id: "weight",
            label: String(localized: "Weight"),
            value: weighIn.weight.text,
            unit: weighIn.weight.unit
        )
        let bodyFat = weighIn.bodyFat.map {
            WeighInTile(id: "bodyFat", label: String(localized: "Body fat"), value: $0.text, unit: nil)
        }
        return [weight] + (bodyFat.map { [$0] } ?? [])
    }
}

/// Plain labels for the weigh-in screen.
nonisolated enum WeighInText {
    /// "From the Renpho scale", or nil when the source is unknown.
    static func source(_ source: String?) -> String? {
        switch source {
        case "renpho": String(localized: "From the Renpho scale")
        case "garmin": String(localized: "From Garmin")
        case "apple_health": String(localized: "From Apple Health")
        case let other?: String(localized: "From \(other)")
        case nil: nil
        }
    }
}
