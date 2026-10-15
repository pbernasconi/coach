import KoboTokens
import SwiftUI

/// A horizontally scrolling row of filters under a search field: a "Filters" chip that opens every filter at once,
/// with a badge counting the filters that are on, then one `FilterChip` per facet. Inside a page gutter the row runs
/// to the screen edges while its first chip lines up with the gutter.
///
///     FilterBar(activeCount: filters.activeCount, onFilters: { sheet = .all }) {
///         FilterChip("Diet", selection: diets, onClear: clearDiets) { sheet = .diet }
///         FilterChip("Cuisine", selection: cuisines, onClear: clearCuisines) { sheet = .cuisine }
///     }
public struct FilterBar<Content: View>: View {
    private let activeCount: Int
    private let onFilters: () -> Void
    private let content: Content

    /// - Parameters:
    ///   - activeCount: how many filters are on; the badge hides at zero.
    ///   - onFilters: opens the sheet that edits every filter.
    public init(
        activeCount: Int,
        onFilters: @escaping () -> Void,
        @ViewBuilder content: () -> Content
    ) {
        self.activeCount = activeCount
        self.onFilters = onFilters
        self.content = content()
    }

    public var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: Space.sm) {
                FiltersButton(activeCount: activeCount, action: onFilters)
                content
            }
            .pageGutter()
        }
        .scrollIndicators(.hidden)
        .bleedsPageGutter()
        .accessibilityElement(children: .contain)
    }
}

/// The leading chip: a sliders glyph, "Filters" and the count of filters on.
private struct FiltersButton: View {
    let activeCount: Int
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Space.xs) {
                Image(systemName: "slider.horizontal.3").imageScale(.small).accessibilityHidden(true)
                Text("Filters", bundle: .module).lineLimit(1)
                CountBadge(count: activeCount, tone: .accent).accessibilityHidden(true)
            }
        }
        .buttonStyle(ChipStyle(tone: .accent, isSelected: false))
        .accessibilityValue(
            activeCount > 0 ? Text("\(activeCount) on", bundle: .module) : Text(verbatim: "")
        )
    }
}

#if DEBUG
    private struct FilterBarPreview: View {
        @Environment(\.koboTheme) private var theme
        @State private var diets: [String] = ["Vegan", "Halal"]
        @State private var cuisines: [String] = []

        var body: some View {
            VStack(alignment: .leading, spacing: Space.md) {
                SearchField(text: .constant(""), prompt: "Search recipes")
                FilterBar(activeCount: [diets, cuisines].filter { !$0.isEmpty }.count, onFilters: {}) {
                    FilterChip("Diet", selection: diets, onClear: { diets = [] }) { diets = ["Vegan"] }
                    FilterChip("Cuisine", selection: cuisines, onClear: { cuisines = [] }) {
                        cuisines = ["Thai"]
                    }
                    FilterChip("Course", selection: [], onClear: {}) {}
                }
            }
            .pageGutter()
            .frame(maxHeight: .infinity, alignment: .top)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Filter bar") { FilterBarPreview() }
    #Preview("Filter bar · dark, Amber") {
        FilterBarPreview().koboTheme(.amber).preferredColorScheme(.dark)
    }
    #Preview("Filter bar · AX3") { FilterBarPreview().dynamicTypeSize(.accessibility3) }
#endif
