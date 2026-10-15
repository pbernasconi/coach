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
                EmptyState(symbol: "dumbbell", title: "Exercise not found", message: "It may have been removed.")
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

/// The loaded exercise, top to bottom.
private struct ExerciseDetailBody: View {
    let item: ExerciseDetailItem
    let state: ExerciseDetailState
    let send: (ExerciseDetailAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            AppHeader(verbatim: item.name, kicker: item.equipment)
            VStack(alignment: .leading, spacing: Space.xxl) {
                ExerciseMediaView(name: item.name, media: state.media)
                ExerciseFactsSections(item: item)
                if let guide = item.guide {
                    ExerciseGuideSections(guide: guide)
                } else {
                    CardSection("How to") {
                        BodyText(String(localized: "There are no instructions for this exercise yet."))
                    }
                }
                VideoSection(send: send)
                ExerciseHistorySection(history: state.history)
            }
            .pageGutter()
            .padding(.bottom, Space.xxl)
        }
    }
}

/// "Watch technique videos": a YouTube search in the browser or the YouTube app. Nothing is embedded.
private struct VideoSection: View {
    @Environment(\.koboTheme) private var theme
    let send: (ExerciseDetailAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            Button("Watch technique videos", systemImage: "play.rectangle") { send(.videosTapped) }
                .buttonStyle(.kobo(.secondary, width: .full))
            Text("Opens a YouTube search.")
                .font(theme.font(.footnote))
                .foregroundStyle(theme.palette.textSecondary)
        }
    }
}
