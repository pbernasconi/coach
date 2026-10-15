import KoboComponents
import KoboTokens
import SwiftUI

/// Dumb view: the exercise library under a pinned search field (SCR-2).
struct ExercisesContent: View {
    let state: ExercisesState
    let send: (ExercisesAction) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.section) {
                switch state.exercises {
                case .loading:
                    LoadingState()
                case .empty:
                    LibraryLinks(send: send)
                    EmptyState(
                        symbol: "dumbbell",
                        title: "No exercises yet",
                        message: "Add exercises from All exercises; templates and workouts use them."
                    )
                case .failed:
                    ErrorState(title: "Exercises could not be loaded")
                case .loaded:
                    LibraryLinks(send: send)
                    ExerciseList(
                        items: state.visible,
                        query: state.query,
                        thumbnails: state.thumbnails,
                        send: send
                    )
                }
            }
            .pageColumn()
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .tabRootHeader {
            VStack(spacing: 0) {
                AppHeader("Exercises")
                SearchField(
                    text: .action(state.query) { send(.queryChanged($0)) },
                    prompt: "Search exercises"
                )
                .pageGutter()
                .padding(.bottom, Space.sm)
            }
        }
    }
}

/// "All exercises" and "Templates" as tiled rows above the library.
private struct LibraryLinks: View {
    let send: (ExercisesAction) -> Void

    var body: some View {
        ListSection {
            ListRow("All exercises", subtitle: "Browse the exercise catalog", action: { send(.allExercisesTapped) }) {
                // The same tile size as the exercise thumbnails, so every row's text starts on one keyline.
                Thumbnail(systemName: "books.vertical", tone: .accent, side: ExerciseThumbnail.compactSide)
            }
            ListRow("Templates", subtitle: "Workouts you repeat, to plan days from", action: { send(.templatesTapped) })
            {
                Thumbnail(systemName: "list.bullet.rectangle", tone: .accent, side: ExerciseThumbnail.compactSide)
            }
        }
        .listRowDensity(.compact)
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
            ListSection("Your exercises") {
                LazyVStack(spacing: 0) {
                    ForEach(items) { item in
                        ExerciseRow(
                            item: item,
                            thumbnail: item.catalogID.map { thumbnails[$0] ?? .loading },
                            send: send
                        )
                    }
                }
            }
            .listRowDensity(.compact)
        }
    }
}

/// One compact library row: its catalog still (a figure symbol for one without), name and detail.
private struct ExerciseRow: View {
    let item: ExerciseItem
    let thumbnail: MediaImage?
    let send: (ExercisesAction) -> Void

    var body: some View {
        ListRow(verbatim: item.name, subtitle: item.detail, action: { send(.exerciseTapped(item.id)) }) {
            ExerciseThumbnail(
                image: thumbnail ?? .failed,
                name: item.name,
                side: ExerciseThumbnail.compactSide
            )
        }
        .onAppear {
            if let catalogID = item.catalogID { send(.thumbnailNeeded(catalogID: catalogID)) }
        }
    }
}
