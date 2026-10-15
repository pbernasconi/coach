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
                EmptyState(
                    symbol: "dumbbell",
                    title: "Exercise not found",
                    message: "It may have been removed."
                )
                .pageGutter()
            case .failed:
                ErrorState(title: "Exercise could not be loaded")
                    .pageGutter()
            case .loaded(let item):
                ExerciseDetailBody(item: item, state: state, send: send)
            }
        }
        .screenCanvas()
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// The loaded exercise, top to bottom: name, the animation beside its muscles and equipment, recent history in compact
/// rows, then how to do it (with the technique videos link in its header), which is the longest part.
private struct ExerciseDetailBody: View {
    let item: ExerciseDetailItem
    let state: ExerciseDetailState
    let send: (ExerciseDetailAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            ExerciseTitle(name: item.name)
            ExerciseMediaView(item: item, media: state.media, animation: state.animation)
            ExerciseHistorySection(history: state.history)
                .listRowDensity(.compact)
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
        .padding(.top, Space.xs)
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
                .accessibilityLabel(Text("Watch technique videos"))
                .accessibilityHint(Text("Opens a YouTube search."))
        }
    }
}
