import KoboComponents
import KoboTokens
import SwiftUI

/// Live demos for the Search section.
struct SearchDemo: View {
    let component: CatalogComponent
    @State private var query = "ar"
    @Environment(\.koboTheme) private var theme

    var body: some View {
        switch component {
        case .searchField:
            VStack(spacing: Space.lg) {
                SearchField(text: $query, prompt: "Search tasks", onCancel: { query = "" })
                SearchField(verbatim: "Kitchen", prompt: "Search notes", onClear: {}) {}
            }
        case .highlightedText:
            VStack(alignment: .leading, spacing: Space.md) {
                SearchField(text: $query, prompt: "Type to highlight")
                ForEach(CatalogSamples.places) { place in
                    HighlightedText(place.name, query: query)
                }
                HighlightedText("Garden tools and seed packets", query: query)
                    .foregroundStyle(theme.palette.textSecondary)
            }
        default: EmptyView()
        }
    }
}
