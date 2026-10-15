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

/// The loaded exercise, top to bottom: name, the animation beside its muscles and equipment, how to do it (with the
/// technique videos link in its header), then recent history.
private struct ExerciseDetailBody: View {
    let item: ExerciseDetailItem
    let state: ExerciseDetailState
    let send: (ExerciseDetailAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            ExerciseTitle(name: item.name)
            ExerciseMediaView(item: item, media: state.media, animation: state.animation)
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
            ExerciseHistorySection(history: state.history)
        }
        .pageGutter()
        .padding(.top, Space.xs)
        .padding(.bottom, Space.xxl)
    }
}

/// The "How to" card. Its header carries "Videos", a compact link to a YouTube search in the browser or the YouTube
/// app; nothing is embedded.
private struct HowToSection<Content: View>: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let send: (ExerciseDetailAction) -> Void
    @ViewBuilder let content: Content

    var body: some View {
        CardSection(padding: Space.md) {
            content
        } header: {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: Space.xs) {
                    Text("How to")
                    videos
                }
            } else {
                HStack(alignment: .center, spacing: Space.md) {
                    Text("How to")
                        .frame(maxWidth: .infinity, alignment: .leading)
                    videos
                }
            }
        }
    }

    private var videos: some View {
        Button("Videos", systemImage: "play.rectangle.fill") { send(.videosTapped) }
            .buttonStyle(.kobo(.tonal, size: .compact))
            .accessibilityLabel(Text("Watch technique videos"))
            .accessibilityHint(Text("Opens a YouTube search."))
    }
}
