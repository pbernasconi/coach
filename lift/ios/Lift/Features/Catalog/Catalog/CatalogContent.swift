import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// Dumb view: every catalog exercise under a pinned search field and filter bar (SCR-2).
struct CatalogContent: View {
    let state: CatalogState
    let send: (CatalogAction) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                switch state.rows {
                case .loading:
                    LoadingState()
                case .empty:
                    EmptyState(symbol: "dumbbell", title: "No exercises", message: "The catalog is empty.")
                case .failed:
                    ErrorState(
                        title: "The exercise catalog could not be loaded",
                        retry: { send(.retryTapped) }
                    )
                case .loaded(let rows):
                    CatalogList(rows: rows, state: state, send: send)
                }
            }
            .pageGutter()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .navigationTitle(Text("All exercises"))
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaBar(edge: .top, spacing: 0) {
            if case .loaded = state.rows {
                CatalogFilterBar(state: state, send: send)
            }
        }
        .koboSheet(
            item: Binding<CatalogSheet?>.action(state.sheet) { if $0 == nil { send(.sheetDismissed) } },
            title: CatalogText.title(sheet:),
            detents: [.medium, .large],
            background: .canvas
        ) { sheet in
            CatalogFilterSheet(sheet: sheet, state: state, send: send)
        } footer: { sheet in
            CatalogSheetFooter(sheet: sheet, state: state, send: send)
        }
    }
}

/// The count and the rows, or a note that nothing matches.
private struct CatalogList: View {
    let rows: [CatalogRow]
    let state: CatalogState
    let send: (CatalogAction) -> Void

    var body: some View {
        if rows.isEmpty {
            EmptyState(
                symbol: "magnifyingglass",
                title: "No matches",
                message: "Try a different search or fewer filters."
            )
        } else {
            ListSection {
                LazyVStack(spacing: 0) {
                    ForEach(rows) { row in
                        CatalogRowView(row: row, image: state.thumbnails[row.id] ?? .loading, send: send)
                    }
                }
            } header: {
                Text(
                    verbatim: CatalogText.count(
                        shown: rows.count,
                        total: state.total,
                        isFiltered: state.isFiltered
                    )
                )
            }
            .listRowDensity(.compact)
        }
    }
}

/// One compact row: a small still, the name and "Target · Equipment".
private struct CatalogRowView: View {
    let row: CatalogRow
    let image: MediaImage
    let send: (CatalogAction) -> Void

    var body: some View {
        ListRow(verbatim: row.name, subtitle: row.detail, action: { send(.rowTapped(row.id)) }) {
            ExerciseThumbnail(image: image, name: row.name, side: ExerciseThumbnail.compactSide)
        }
        .onAppear { send(.rowAppeared(row.id)) }
    }
}
