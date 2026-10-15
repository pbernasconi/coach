import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// Dumb view: a pinned search field and a switch between the person's exercises and the whole catalog, then the
/// matching rows. A tap adds the exercise (SCR-2).
struct ExercisePickerContent: View {
    let state: ExercisePickerState
    let send: (ExercisePickerAction) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                switch state.source {
                case .library: PickerLibraryList(state: state, send: send)
                case .catalog: PickerCatalogList(state: state, send: send)
                }
            }
            .pageColumn()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .scrollDismissesKeyboard(.immediately)
        .screenCanvas()
        .navigationTitle(Text("Add exercise"))
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaBar(edge: .top, spacing: 0) {
            VStack(alignment: .leading, spacing: Space.sm) {
                SearchField(text: .action(state.query) { send(.queryChanged($0)) }, prompt: "Search exercises")
                SegmentedPicker(
                    "Exercises to show",
                    selection: .action(state.source) { send(.sourceChanged($0)) },
                    options: [
                        ChoiceOption(.library, title: "Your exercises"),
                        ChoiceOption(.catalog, title: "All exercises"),
                    ]
                )
            }
            .pageGutter()
            .padding(.bottom, Space.sm)
        }
    }
}

/// The person's exercises that match the search, or why there are none.
private struct PickerLibraryList: View {
    let state: ExercisePickerState
    let send: (ExercisePickerAction) -> Void

    var body: some View {
        switch state.library {
        case .loading:
            LoadingState()
        case .empty:
            EmptyState(symbol: "dumbbell", title: "No exercises", message: "Pick one from All exercises.")
        case .failed:
            ErrorState(title: "Exercises could not be loaded")
        case .loaded:
            let items = state.visibleLibrary
            if items.isEmpty {
                PickerNoMatches(query: state.query)
            } else {
                ListSection {
                    LazyVStack(spacing: 0) {
                        ForEach(items) { item in
                            PickerRow(
                                name: item.name,
                                detail: item.detail,
                                catalogID: item.catalogID,
                                image: item.catalogID.map { state.thumbnails[$0] ?? .loading },
                                isAdding: state.adding == .library(item.id),
                                action: { send(.libraryTapped(item.id)) },
                                send: send
                            )
                        }
                    }
                }
                .listRowDensity(.compact)
            }
        }
    }
}

/// The catalog entries that match the search, or why there are none.
private struct PickerCatalogList: View {
    let state: ExercisePickerState
    let send: (ExercisePickerAction) -> Void

    var body: some View {
        switch state.catalog {
        case .loading:
            LoadingState()
        case .empty:
            EmptyState(symbol: "dumbbell", title: "No exercises", message: "The catalog is empty.")
        case .failed:
            ErrorState(title: "The exercise catalog could not be loaded")
        case .loaded(let rows) where rows.isEmpty:
            PickerNoMatches(query: state.query)
        case .loaded(let rows):
            ListSection {
                LazyVStack(spacing: 0) {
                    ForEach(rows) { row in
                        PickerRow(
                            name: row.name,
                            detail: row.detail,
                            catalogID: row.id,
                            image: state.thumbnails[row.id] ?? .loading,
                            isAdding: state.adding == .catalog(row.id),
                            action: { send(.catalogTapped(row.id)) },
                            send: send
                        )
                    }
                }
            }
            .listRowDensity(.compact)
        }
    }
}

private struct PickerNoMatches: View {
    let query: String

    var body: some View {
        EmptyState(
            symbol: "magnifyingglass",
            verbatim: String(localized: "No matches for “\(query)”"),
            message: String(localized: "Try a different search.")
        )
    }
}

/// One compact row: the still (a figure symbol for an exercise without one), the name and its detail, and a plus;
/// a spinner replaces the plus while the exercise is being added.
private struct PickerRow: View {
    @Environment(\.koboTheme) private var theme
    let name: String
    let detail: String
    let catalogID: String?
    let image: MediaImage?
    let isAdding: Bool
    let action: () -> Void
    let send: (ExercisePickerAction) -> Void

    var body: some View {
        ListRow(
            verbatim: name,
            subtitle: detail,
            action: action,
            leading: { ExerciseThumbnail(image: image ?? .failed, name: name, side: ExerciseThumbnail.compactSide) },
            trailing: {
                Group {
                    if isAdding {
                        ProgressView()
                    } else {
                        Image(systemName: "plus.circle.fill")
                            .font(theme.font(.title2))
                            .foregroundStyle(theme.palette.accent)
                    }
                }
                .accessibilityHidden(true)
            }
        )
        .accessibilityHint(Text("Adds the exercise"))
        .onAppear {
            if let catalogID { send(.thumbnailNeeded(catalogID: catalogID)) }
        }
    }
}
