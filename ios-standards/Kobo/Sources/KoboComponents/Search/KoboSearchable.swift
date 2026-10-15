import KoboTokens
import SwiftUI

/// Where `koboSearchable` puts the system search field.
public enum KoboSearchPlacement: Sendable, Hashable, CaseIterable {
    /// The system's choice for the context.
    case automatic
    /// Always shown at the top, in the navigation bar drawer (iOS); for a feed with a header of its own.
    case top
    /// The bottom toolbar, near the thumb (iOS 26); for a picker or a searchable list.
    case bottom
}

extension View {
    /// The system search field, the Kobo way: the library's "Search" prompt by default, a drag of the content
    /// dismisses the keyboard, the Search key calls `onSubmit`, and `isFocused` mirrors the field's focus both ways (so
    /// a search screen can open with the keyboard up). Apply it to the root view of a `NavigationStack` destination.
    /// The caller filters as `text` changes (`SearchMatch.ranked` ranks and highlights).
    ///
    ///     List(results) { … }
    ///         .koboSearchable(text: $query, prompt: "Search recipes", placement: .bottom)
    public func koboSearchable(
        text: Binding<String>,
        prompt: LocalizedStringKey? = nil,
        placement: KoboSearchPlacement = .automatic,
        isFocused: Binding<Bool>? = nil,
        onSubmit: (() -> Void)? = nil
    ) -> some View {
        modifier(
            KoboSearchableModifier(
                text: text,
                prompt: prompt.map { Text($0) } ?? Text("Search", bundle: .module),
                placement: placement,
                isFocused: isFocused,
                onSubmit: onSubmit
            )
        )
    }

    /// A search mode that commits its query: while `isPresented`, the caller's `suggestions` replace the content (on
    /// the canvas, with `hint` above them while the query is short), and the Search key commits a query with text, or a
    /// blank query that removes the `committed` one (`onSubmit`). The draft changes only the search, so the content under
    /// it never re-renders on each keystroke. Set `isPresented` to false to end the search after a commit.
    ///
    ///     feed.koboSearchable(text: $draft, isPresented: $isSearching, hint: "Search names and notes",
    ///                         committed: query, onSubmit: commit) { RecentSearches(…) }
    public func koboSearchable<Suggestions: View>(
        text: Binding<String>,
        prompt: LocalizedStringKey? = nil,
        placement: KoboSearchPlacement = .top,
        isPresented: Binding<Bool>,
        hint: LocalizedStringKey? = nil,
        committed: String = "",
        onSubmit: @escaping () -> Void,
        @ViewBuilder suggestions: () -> Suggestions
    ) -> some View {
        modifier(
            KoboSearchModeModifier(
                text: text,
                prompt: prompt.map { Text($0) } ?? Text("Search", bundle: .module),
                placement: placement,
                isPresented: isPresented,
                hint: hint.map { Text($0) },
                committed: committed,
                onSubmit: onSubmit,
                suggestions: suggestions()
            )
        )
    }
}

private struct KoboSearchableModifier: ViewModifier {
    @FocusState private var focus: Bool
    let text: Binding<String>
    let prompt: Text
    let placement: KoboSearchPlacement
    let isFocused: Binding<Bool>?
    let onSubmit: (() -> Void)?

    func body(content: Content) -> some View {
        content
            .scrollDismissesKeyboard(.interactively)
            .searchablePlaced(text: text, isPresented: nil, prompt: prompt, placement: placement)
            .searchFocused($focus)
            .onSubmit(of: .search) { onSubmit?() }
            .onChange(of: isFocused?.wrappedValue, initial: true) { _, wanted in
                if let wanted, wanted != focus { focus = wanted }
            }
            .onChange(of: focus) { _, new in
                if let isFocused, isFocused.wrappedValue != new { isFocused.wrappedValue = new }
            }
    }
}

private struct KoboSearchModeModifier<Suggestions: View>: ViewModifier {
    @Environment(\.koboTheme) private var theme
    let text: Binding<String>
    let prompt: Text
    let placement: KoboSearchPlacement
    let isPresented: Binding<Bool>
    let hint: Text?
    let committed: String
    let onSubmit: () -> Void
    let suggestions: Suggestions

    func body(content: Content) -> some View {
        content
            .scrollDismissesKeyboard(.interactively)
            .accessibilityHidden(isPresented.wrappedValue)
            .overlay(alignment: .top) {
                if isPresented.wrappedValue { suggestionsPage }
            }
            .searchablePlaced(text: text, isPresented: isPresented, prompt: prompt, placement: placement)
            .onSubmit(of: .search) {
                if SearchModeLogic.canSubmit(query: text.wrappedValue, committed: committed) { onSubmit() }
            }
    }

    /// The suggestions on the page canvas, not in `searchSuggestions`, which turns an empty container into blank rows.
    private var suggestionsPage: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.md) {
                if let hint, SearchModeLogic.showsHint(query: text.wrappedValue) {
                    hint
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textSecondary)
                        .padding(.horizontal, Space.gutter)
                }
                suggestions
            }
            .padding(.top, Space.md)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollDismissesKeyboard(.interactively)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(theme.palette.canvas)
    }
}

extension View {
    /// `.searchable` at the placement, with or without an `isPresented` binding.
    @ViewBuilder
    fileprivate func searchablePlaced(
        text: Binding<String>,
        isPresented: Binding<Bool>?,
        prompt: Text,
        placement: KoboSearchPlacement
    ) -> some View {
        let fieldPlacement = placement.fieldPlacement
        if let isPresented {
            searchable(text: text, isPresented: isPresented, placement: fieldPlacement, prompt: prompt)
                .searchToolbarPlacement(placement)
        } else {
            searchable(text: text, placement: fieldPlacement, prompt: prompt)
                .searchToolbarPlacement(placement)
        }
    }

    /// Moves the search field into the bottom toolbar for `.bottom` (iOS); elsewhere it stays where it is.
    @ViewBuilder
    fileprivate func searchToolbarPlacement(_ placement: KoboSearchPlacement) -> some View {
        #if os(iOS)
            if placement == .bottom {
                toolbar { DefaultToolbarItem(kind: .search, placement: .bottomBar) }
            } else {
                self
            }
        #else
            self
        #endif
    }
}

extension KoboSearchPlacement {
    fileprivate var fieldPlacement: SearchFieldPlacement {
        #if os(iOS)
            switch self {
            case .top: .navigationBarDrawer(displayMode: .always)
            case .automatic, .bottom: .automatic
            }
        #else
            .automatic
        #endif
    }
}

#if DEBUG
    private struct KoboSearchableGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var query = ""
        private let names = ["Miso soup", "Lemon risotto", "Mushroom risotto", "Pea soup", "Crème brûlée tarts"]

        var body: some View {
            NavigationStack {
                List(SearchMatch.ranked(names, query: query) { $0 }, id: \.element) { result in
                    HighlightedText(result.element, ranges: result.match.ranges)
                }
                .navigationTitle(Text(verbatim: "Recipes"))
                .koboSearchable(text: $query, prompt: "Search recipes", placement: .bottom)
            }
        }
    }

    #Preview("Searchable") { KoboSearchableGallery() }
    #Preview("Searchable · dark, Amber") { KoboSearchableGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Searchable · AX3") { KoboSearchableGallery().dynamicTypeSize(.accessibility3) }
#endif
