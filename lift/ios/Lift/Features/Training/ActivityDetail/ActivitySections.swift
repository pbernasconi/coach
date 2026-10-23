import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// The activity page as one summary, Strava's order: the title, the six headline numbers, a card per chart (each
/// opens its full page), the splits, the load, the best efforts and segments, then the small facts. Every full table
/// and chart is one tap away on its own page (`ActivityPanelPage`). A section the activity does not have is hidden;
/// one the server could not load shows its own line.
struct ActivitySections: View {
    let detail: ActivityDetail
    /// "How did it feel", under the numbers; nil hides it.
    let feedback: WorkoutFeedback?
    let save: WorkoutFeedbackSaveState
    let send: (ActivityDetailAction) -> Void
    @State private var showsAll = false

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            OptionalSection(nil, detail.header) { header in
                ActivityHeaderView(header: header, planned: detail.coach?.value?.planned)
            }
            OptionalSection(nil, detail.overview) { overview in
                ActivityStatGrid(overview: overview) { send(.panelTapped(.stats)) }
            }
            if let feedback {
                WorkoutFeedbackCard(feedback: feedback, save: save) { send(.feedback($0)) }
            }
            if showsAll {
                ActivityLowerSections(detail: detail, send: send)
            }
        }
        // The charts and tables come one frame after the top, so the page's first frame (and the map sheet's drop)
        // is not held up by work that starts below the fold.
        .task { showsAll = true }
    }
}

/// Everything under "How did it feel": the chart cards, the splits, the load, the best efforts and segments.
private struct ActivityLowerSections: View {
    let detail: ActivityDetail
    let send: (ActivityDetailAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            OptionalSection(nil, detail.analysis) { analysis in
                ActivityChartCards(analysis: analysis, detail: detail, send: send)
            }
            OptionalSection("Splits", detail.splits) { splits in
                ActivitySplitBars(splits: splits) { send(.panelTapped(.splits)) }
            }
            if detail.splits == nil, let laps = detail.laps?.value {
                ActivitySeeAll(verbatim: String(localized: "Laps"), value: "\(laps.rows.count)") {
                    send(.panelTapped(.laps))
                }
            }
            OptionalSection("Training load", detail.coach) { ActivityLoadRow(coach: $0) }
            OptionalSection("Best efforts", detail.bestEfforts) { efforts in
                ActivityTopRows(
                    rows: efforts.rows.prefix(Self.topRows).map {
                        ActivityTopRow(id: $0.label, title: $0.label, value: $0.timeText, isBest: $0.prRank == 1)
                    },
                    total: efforts.rows.count
                ) { send(.panelTapped(.bestEfforts)) }
            }
            OptionalSection("Segments", detail.segments) { segments in
                ActivityTopRows(
                    rows: segments.rows.prefix(Self.topRows).map {
                        ActivityTopRow(
                            id: $0.id,
                            title: $0.name,
                            value: $0.timeText,
                            detail: $0.rankText.isEmpty ? nil : $0.rankText,
                            isBest: $0.prRank == 1 || $0.komRank != nil
                        )
                    },
                    total: segments.count
                ) { send(.panelTapped(.segments)) }
            }
            OptionalSection(nil, detail.sameRoute) { sameRoute in
                VStack(alignment: .leading, spacing: Space.sm) {
                    SectionHeader(verbatim: sameRoute.title)
                    ActivityTopRows(
                        rows: sameRoute.rows.prefix(Self.topRows).map {
                            ActivityTopRow(
                                id: $0.activityId,
                                title: $0.name,
                                value: $0.timeText,
                                detail: $0.day,
                                isBest: $0.isThis
                            )
                        },
                        total: sameRoute.rows.count
                    ) { send(.panelTapped(.sameRoute)) }
                }
            }
            ActivityFacts(detail: detail)
            if let header = detail.header?.value, let url = URL(string: header.stravaUrl) {
                Link(destination: url) {
                    Label("View on Strava", systemImage: "arrow.up.right")
                }
                .buttonStyle(.kobo(.plain, size: .compact))
                .frame(maxWidth: .infinity)
            }
        }
    }

    /// Rows shown before "See all".
    static let topRows = 3
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
        TileGrid(effort.stats, id: \.label) { stat in StatTile(verbatim: stat.label, value: stat.valueText) }
    }
}
