import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// The search field and, under it, one scrolling row of filters: Filters, a chip per facet and "In my library".
struct CatalogFilterBar: View {
    let state: CatalogState
    let send: (CatalogAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            SearchField(
                text: .action(state.query) { send(.queryChanged($0)) },
                prompt: "Search exercises"
            )
            FilterBar(activeCount: state.filter.activeCount, onFilters: { send(.filtersTapped) }) {
                ForEach(CatalogFacet.allCases) { facet in
                    FilterChip(
                        verbatim: CatalogText.title(facet),
                        selection: state.chosenLabels(facet),
                        onClear: { send(.facetCleared(facet)) },
                        action: { send(.facetTapped(facet)) }
                    )
                }
                if !state.library.isEmpty {
                    Chip("In my library", systemImage: "books.vertical", isSelected: state.filter.inLibrary) {
                        send(.libraryToggled)
                    }
                }
            }
        }
        .pageGutter()
        .padding(.bottom, Space.xs)
    }
}
