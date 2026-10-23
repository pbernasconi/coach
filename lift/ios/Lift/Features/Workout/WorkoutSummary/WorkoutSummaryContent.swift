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
                    SummaryHealthRow(health: state.health, send: send)
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

/// The day, then duration (when known) and sets as tiles: in one row while they fit, stacked at large text
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

/// The first finish asks before the system sheet does (PLAT-5); afterwards a saved workout says so.
private struct SummaryHealthRow: View {
    let health: SummaryHealth?
    let send: (WorkoutSummaryAction) -> Void

    var body: some View {
        switch health {
        case .ask:
            NoticeBanner(
                tone: .accent,
                symbol: "heart",
                title: "Save workouts to Apple Health?",
                message: "Each finished workout is saved as strength training, with its start, end and title.",
                action: .init("Save to Apple Health") { send(.healthAllowTapped) },
                onDismiss: { send(.healthNotNowTapped) }
            )
        case .saved:
            ListSection {
                ListRow("Apple Health", value: String(localized: "Saved")) {
                    Thumbnail(systemName: "heart", tone: .accent, side: ExerciseThumbnail.compactSide)
                }
            }
            .listRowDensity(.compact)
        case nil:
            EmptyView()
        }
    }
}
