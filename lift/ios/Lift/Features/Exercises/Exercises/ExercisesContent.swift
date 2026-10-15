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
                    ListSection {
                        ListRow(
                            "All exercises",
                            subtitle: "Browse the exercise catalog",
                            action: {
                                send(.allExercisesTapped)
                            }
                        ) {
                            Image(systemName: "books.vertical").accessibilityHidden(true)
                        }
                    }
                    ExerciseList(items: state.visible, query: state.query, thumbnails: state.thumbnails, send: send)
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
    let thumbnails: [String: MediaImage]
    let send: (ExercisesAction) -> Void

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
                        ExerciseRow(
                            item: item,
                            thumbnail: item.catalogID.map { thumbnails[$0] ?? .loading },
                            send: send
                        )
                    }
                }
            } header: {
                EmptyView()
            } footer: {
                if items.contains(where: { $0.catalogID != nil }) {
                    MediaAttribution()  // the credit for the thumbnails
                }
            }
        }
    }
}

/// One library exercise: its catalog still (a figure symbol for one without), name and detail.
private struct ExerciseRow: View {
    let item: ExerciseItem
    let thumbnail: MediaImage?
    let send: (ExercisesAction) -> Void

    var body: some View {
        ListRow(verbatim: item.name, subtitle: item.detail, action: { send(.exerciseTapped(item.id)) }) {
            ExerciseThumbnail(image: thumbnail ?? .failed, name: item.name)
        }
        .onAppear {
            if let catalogID = item.catalogID { send(.thumbnailNeeded(catalogID: catalogID)) }
        }
    }
}
