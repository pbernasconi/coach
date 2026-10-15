import KoboComponents
import KoboTokens
import SwiftUI

/// Dumb view: every catalog exercise under a search field and filters (SCR-2).
struct CatalogContent: View {
    let state: CatalogState
    let send: (CatalogAction) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                AppHeader("All exercises")
                switch state.rows {
                case .loading:
                    LoadingState()
                case .empty:
                    EmptyState(symbol: "dumbbell", title: "No exercises", message: "The catalog is empty.")
                case .failed:
                    ErrorState(title: "The exercise catalog could not be loaded", retry: { send(.retryTapped) })
                case .loaded(let rows):
                    CatalogFilters(state: state, send: send)
                    CatalogList(rows: rows, state: state, send: send)
                }
            }
            .pageGutter()
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// The count, the credit for the thumbnails, and the rows (or a note that nothing matches).
private struct CatalogList: View {
    @Environment(\.koboTheme) private var theme
    let rows: [CatalogRow]
    let state: CatalogState
    let send: (CatalogAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            HStack(alignment: .firstTextBaseline) {
                Text(verbatim: count)
                    .font(theme.font(.footnote).weight(.semibold))
                    .foregroundStyle(theme.palette.textSecondary)
                Spacer(minLength: Space.md)
                MediaAttribution()
            }
            .padding(.horizontal, Space.lg)
            if rows.isEmpty {
                EmptyState(
                    symbol: "magnifyingglass",
                    title: "No matches",
                    message: "Try a different search or filter."
                )
            } else {
                ListSection {
                    LazyVStack(spacing: 0) {
                        ForEach(rows) { row in
                            CatalogRowView(row: row, image: state.thumbnails[row.id] ?? .loading, send: send)
                        }
                    }
                }
            }
        }
    }

    private var count: String {
        state.isFiltered
            ? String(localized: "\(rows.count) of \(state.total) exercises")
            : String(localized: "\(state.total) exercises")
    }
}

/// One row: the still, the name and "Target · Equipment".
private struct CatalogRowView: View {
    let row: CatalogRow
    let image: MediaImage
    let send: (CatalogAction) -> Void

    var body: some View {
        ListRow(verbatim: row.name, subtitle: row.detail, action: { send(.rowTapped(row.id)) }) {
            ExerciseThumbnail(image: image, name: row.name)
        }
        .onAppear { send(.rowAppeared(row.id)) }
    }
}
