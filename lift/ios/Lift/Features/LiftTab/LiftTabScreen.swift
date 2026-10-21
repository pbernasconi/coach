import KoboComponents
import KoboTokens
import SwiftUI

/// The Lift tab: a segment control over three screens that share the tab's navigation stack: the coach's Lift overview,
/// the logged sessions (History) and the exercise library (Exercises). Each screen keeps its own header and actions.
struct LiftTabScreen: View {
    @Environment(\.koboTheme) private var theme
    let dependencies: AppDependencies
    let router: any Navigating
    /// History's first view: Sessions, or Progress for `-open progress`.
    let historySegment: HistorySegment
    @State private var segment: LiftSegment
    /// The overview's ViewModel, kept across segment switches (no refetch, folded sections kept).
    @State private var overview: LiftOverviewViewModel

    init(
        dependencies: AppDependencies,
        router: any Navigating,
        historySegment: HistorySegment,
        initialSegment: LiftSegment
    ) {
        self.dependencies = dependencies
        self.router = router
        self.historySegment = historySegment
        _segment = State(initialValue: initialSegment)
        _overview = State(initialValue: LiftOverviewRoute.makeViewModel(dependencies: dependencies, router: router))
    }

    var body: some View {
        content
            .safeAreaBar(edge: .top, spacing: 0) {
                SegmentedPicker("Lift", selection: $segment, options: Self.options)
                    .pageGutter()
                    .padding(.top, Space.sm)
                    .padding(.bottom, Space.xs)
            }
    }

    private static let options = [
        ChoiceOption(LiftSegment.overview, title: "Overview"),
        ChoiceOption(LiftSegment.history, title: "History"),
        ChoiceOption(LiftSegment.exercises, title: "Exercises"),
    ]

    @ViewBuilder private var content: some View {
        switch segment {
        case .overview:
            LiftOverviewScreen(viewModel: overview)
        case .history:
            HistoryScreen(
                viewModel: HistoryViewModel(
                    sessions: dependencies.sessions,
                    exercises: dependencies.exercises,
                    router: router,
                    importFlow: dependencies.importFlow,
                    now: dependencies.now,
                    calendar: dependencies.calendar,
                    segment: historySegment,
                    opensCoachSessions: dependencies.appData is LiveAppData
                )
            )
        case .exercises:
            ExercisesScreen(
                viewModel: ExercisesViewModel(
                    exercises: dependencies.exercises,
                    catalog: dependencies.catalog,
                    router: router
                )
            )
        }
    }
}
