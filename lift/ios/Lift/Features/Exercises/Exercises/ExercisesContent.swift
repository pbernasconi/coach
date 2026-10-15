import KoboComponents
import KoboTokens
import SwiftUI

/// Dumb view: the exercise library under a pinned search field (SCR-2).
struct ExercisesContent: View {
    let state: ExercisesState
    let send: (ExercisesAction) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.xl) {
                switch state.exercises {
                case .loading:
                    LoadingState()
                case .empty:
                    EmptyState(symbol: "dumbbell", title: "No exercises", message: "The exercise library is empty.")
                case .failed:
                    ErrorState(title: "Exercises could not be loaded")
                case .loaded:
                    ExerciseList(items: state.visible, query: state.query)
                }
            }
            .pageGutter()
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .tabRootHeader {
            VStack(spacing: 0) {
                AppHeader("Exercises")
                SearchField(text: .action(state.query) { send(.queryChanged($0)) }, prompt: "Search exercises")
                    .padding(.horizontal, Space.gutter)
                    .padding(.bottom, Space.sm)
            }
        }
    }
}

/// The matching exercises, or a note that nothing matches.
private struct ExerciseList: View {
    let items: [ExerciseItem]
    let query: String

    var body: some View {
        if items.isEmpty {
            EmptyState(
                symbol: "magnifyingglass",
                verbatim: String(localized: "No matches for “\(query)”"),
                message: String(localized: "Try a different search.")
            )
        } else {
            ListSection {
                LazyVStack(spacing: 0) {
                    ForEach(items) { item in
                        ListRow(verbatim: item.name, subtitle: item.detail)
                    }
                }
            }
        }
    }
}
