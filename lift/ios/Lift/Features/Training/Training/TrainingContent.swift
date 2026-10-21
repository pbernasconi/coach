import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Dumb view: the Activities | Trends picker over the list or the Trends page (SCR-2).
struct TrainingContent: View {
    let state: TrainingState
    let send: (TrainingAction) -> Void

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Space.section) {
                SegmentedPicker(
                    "Training view",
                    selection: .action(state.segment) { send(.segmentChanged($0)) },
                    options: [
                        ChoiceOption(TrainingSegment.activities, title: "Activities"),
                        ChoiceOption(TrainingSegment.trends, title: "Trends"),
                    ]
                )
                .dynamicTypeSize(...HistoryMetrics.pickerTypeSize)
                switch state.segment {
                case .activities:
                    AppResourcePage(
                        state.list,
                        onRetry: { send(.activitiesRetryTapped) },
                        onConnect: { send(.connectTapped) }
                    ) { page in
                        ActivityList(page: page, rows: state.rows, footer: state.footer, send: send)
                    }
                case .trends:
                    AppResourcePage(
                        state.trends,
                        onRetry: { send(.trendsRetryTapped) },
                        onConnect: { send(.connectTapped) }
                    ) { trends in
                        TrendsPage(trends: trends, peaksWindow: state.peaksWindow, send: send)
                    }
                }
            }
            .pageColumn()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .tabRootHeader { AppHeader("Training") }
    }
}

/// The activities, newest first, with the paging footer.
private struct ActivityList: View {
    let page: ActivityListPage
    let rows: [ActivitySummary]
    let footer: LoadMoreFooterModel
    let send: (TrainingAction) -> Void

    var body: some View {
        if rows.isEmpty {
            EmptyState(
                symbol: "figure.run",
                title: "No activities yet",
                message: "Activities show here once Strava sends them to the coach app."
            )
        } else {
            VStack(alignment: .leading, spacing: Space.sm) {
                if !page.plannedOk {
                    InlineNotice("Planned workouts could not be matched.", tone: .warning)
                }
                ListSection {
                    ForEach(rows) { row in
                        ActivityRow(activity: row) { send(.activityTapped(row.id)) }
                    }
                }
                LoadMoreFooter(footer, trigger: .automatic) { send(.loadMoreTapped) }
            }
        }
    }
}
