import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// Dumb view: the illustration, how to do the exercise, technique videos and recent history (SCR-2).
struct ExerciseDetailContent: View {
    let state: ExerciseDetailState
    let send: (ExerciseDetailAction) -> Void

    var body: some View {
        ScrollView {
            switch state.exercise {
            case .loading:
                LoadingState()
                    .pageGutter()
            case .empty:
                // No library exercise (a `name-…` key, or a removed one): the coach's page alone, with its loading,
                // retry, "not connected" and "Coach has nothing here" states.
                AppResourcePage(state.server, onRetry: { send(.retryTapped) }) { stats in
                    ExerciseServerOnlyBody(stats: stats, state: state, send: send)
                }
                .pageGutter()
            case .failed:
                ErrorState(title: "Exercise could not be loaded")
                    .pageGutter()
            case .loaded(let item):
                ExerciseDetailBody(item: item, state: state, send: send)
            }
        }
        .screenCanvas()
        .navigationTitle(Text(verbatim: title))
        .navigationBarTitleDisplayMode(.inline)
    }

    /// The exercise's name as the inline title every pushed screen uses: the library's, else the coach's.
    private var title: String {
        if case .loaded(let item) = state.exercise { return item.name }
        return state.server.content.value?.name ?? ""
    }
}

/// The loaded exercise, top to bottom: the animation beside its muscles and equipment; the coach's numbers when they
/// loaded, else the local progress chart and recent history (never both); then how to do it (with the technique
/// videos link in its header), which is the longest part. The name is the bar title.
private struct ExerciseDetailBody: View {
    let item: ExerciseDetailItem
    let state: ExerciseDetailState
    let send: (ExerciseDetailAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            ExerciseMediaView(item: item, media: state.media, animation: state.animation)
            if let stats = state.serverStats {
                ExerciseServerSections(
                    stats: stats,
                    freshness: state.server.freshness,
                    chart: state.serverChart,
                    point: state.serverPoint,
                    isSessionsExpanded: state.isServerSessionsExpanded,
                    send: send
                )
            } else {
                ExerciseProgressSection(
                    progress: state.progress,
                    rangeChanged: { send(.progressRangeChanged($0)) },
                    selectionChanged: { send(.progressSelectionChanged($0)) }
                )
                ExerciseHistorySection(history: state.history)
                    .listRowDensity(.compact)
            }
            if let guide = item.guide {
                HowToSection(send: send) { ExerciseGuideSections(guide: guide) }
            } else if !state.librarySteps.isEmpty {
                HowToSection(send: send) {
                    Collapsible(
                        "From the exercise library",
                        isExpanded: .action(state.isLibraryStepsExpanded) {
                            send(.libraryStepsExpandedChanged($0))
                        }
                    ) {
                        CatalogSteps(steps: state.librarySteps)
                    }
                }
            } else {
                HowToSection(send: send) {
                    BodyText(String(localized: "There are no instructions for this exercise yet."))
                }
            }
        }
        .pageColumn()
        .padding(.top, Space.sm)
        .padding(.bottom, Space.xxl)
    }
}

/// The "How to" part, flat on the page like the rest. Its heading carries "Videos", a compact link to a YouTube search
/// in the browser or the YouTube app; nothing is embedded.
private struct HowToSection<Content: View>: View {
    let send: (ExerciseDetailAction) -> Void
    @ViewBuilder let content: Content

    var body: some View {
        DetailSection("How to") {
            content
        } accessory: {
            Button("Videos", systemImage: "play.rectangle.fill") { send(.videosTapped) }
                .buttonStyle(.kobo(.plain, size: .compact, width: .inline))
                .imageScale(.small)
                .accessibilityLabel(Text("Watch technique videos"))
                .accessibilityHint(Text("Opens a YouTube search."))
        }
    }
}

/// An exercise the coach knows but this iPhone's library does not (a `name-…` key, or a removed exercise): the coach's
/// numbers alone, or the page failure when they did not load.
private struct ExerciseServerOnlyBody: View {
    let stats: LiftExerciseStats
    let state: ExerciseDetailState
    let send: (ExerciseDetailAction) -> Void

    var body: some View {
        ExerciseServerSections(
            stats: stats,
            freshness: nil,  // `AppResourcePage` shows it above
            chart: state.serverChart,
            point: state.serverPoint,
            isSessionsExpanded: state.isServerSessionsExpanded,
            send: send
        )
        .padding(.top, Space.sm)
        .padding(.bottom, Space.xxl)
    }
}
