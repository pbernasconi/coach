import KoboComponents
import KoboTokens
import SwiftUI

/// Dumb view: the workout's day, its numbers as tiles, the records it beat, and Done (SCR-2). Numbers only.
struct WorkoutSummaryContent: View {
    let state: WorkoutSummaryState
    let send: (WorkoutSummaryAction) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.section) {
                switch state.summary {
                case .loading:
                    LoadingState()
                case .empty:
                    EmptyState(
                        symbol: "figure.strengthtraining.traditional",
                        title: "Workout not found",
                        message: "It may have been removed or moved."
                    )
                case .failed:
                    ErrorState(title: "The summary could not be loaded")
                case .loaded(let summary):
                    SummaryNumbers(summary: summary)
                    SummaryBests(bests: summary.bests)
                }
            }
            .pageColumn()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .navigationTitle(Text(verbatim: title))
        .navigationBarTitleDisplayMode(.inline)
        .pinnedFooter(isPresented: true) {
            Button("Done") { send(.doneTapped) }
                .buttonStyle(.kobo(.primary, width: .full))
        }
    }

    private var title: String {
        guard case .loaded(let summary) = state.summary else { return String(localized: "Summary") }
        return summary.title
    }
}

/// The day, then duration (when known), sets and volume as tiles: in one row while they fit, stacked at large text
/// sizes.
private struct SummaryNumbers: View {
    @Environment(\.koboTheme) private var theme
    let summary: WorkoutSummaryOverview

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            Text(verbatim: summary.dayTitle)
                .font(theme.font(.subheadline).weight(.semibold))
                .foregroundStyle(theme.palette.accentText)
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: Space.sm) { tiles }
                VStack(alignment: .leading, spacing: Space.sm) { tiles }
            }
        }
    }

    @ViewBuilder private var tiles: some View {
        if let duration = summary.duration {
            StatTile(label: "Duration", value: duration)
        }
        StatTile(label: "Sets logged", value: summary.sets)
        StatTile(verbatim: String(localized: "Volume"), value: summary.volume, unit: summary.unit)
    }
}

/// The records the workout beat, or "None".
private struct SummaryBests: View {
    let bests: [WorkoutBestItem]

    var body: some View {
        ListSection("New bests") {
            if bests.isEmpty {
                ListRow("None")
                    .listRowEmphasis(.quiet)
            }
            ForEach(bests) { best in
                ListRow(verbatim: best.exercise, subtitle: best.detail, value: best.value) {
                    Thumbnail(systemName: "arrow.up.right", tone: .accent, side: ExerciseThumbnail.compactSide)
                }
            }
        }
        .listRowDensity(.compact)
    }
}
