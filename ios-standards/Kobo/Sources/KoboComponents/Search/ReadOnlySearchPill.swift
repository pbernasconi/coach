import KoboTokens
import SwiftUI

/// The read-only form of `SearchField`: the pill with the committed query (or the prompt) that never takes focus; a
/// tap opens a search mode. VoiceOver reads one search field with the query as its value, and a clear button when
/// `onClear` is set.
struct ReadOnlySearchPill: View {
    @Environment(\.koboTheme) private var theme
    let query: String
    let prompt: Text
    let onClear: (() -> Void)?
    let action: () -> Void

    var body: some View {
        HStack(spacing: Space.sm) {
            Button(action: action) {
                HStack(spacing: Space.sm) {
                    SearchGlyph()
                    Group {
                        if query.isEmpty {
                            prompt.foregroundStyle(theme.palette.textTertiary)
                        } else {
                            Text(verbatim: query).foregroundStyle(theme.palette.textPrimary)
                        }
                    }
                    .font(theme.font(.body))
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxWidth: .infinity, minHeight: Size.minTouch)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(prompt)
            .accessibilityValue(Text(verbatim: query))
            .accessibilityAddTraits(.isSearchField)
            if let onClear, !query.isEmpty {
                FieldIconButton(
                    systemImage: "xmark.circle.fill",
                    label: Text("Clear search", bundle: .module),
                    action: onClear
                )
                .padding(.trailing, -Space.md)
            }
        }
        .searchPill()
    }
}

extension View {
    /// No autocapitalisation, as the system search field. Off iOS it does nothing.
    @ViewBuilder
    func searchCapitalization() -> some View {
        #if os(iOS)
            textInputAutocapitalization(.never)
        #else
            self
        #endif
    }
}

#if DEBUG
    private struct SearchFieldGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var query = ""
        @State private var filled = "soup"
        @FocusState private var isFocused: Bool

        var body: some View {
            VStack(spacing: Space.lg) {
                SearchField(text: $query, prompt: "Search recipes")
                SearchField(text: $filled, onCancel: { filled = "" }).focused(by: $isFocused)
                SearchField(verbatim: "", prompt: "Search history") {}
                SearchField(verbatim: "Miso soup", prompt: "Search history", onClear: {}) {}
            }
            .padding(Space.gutter)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Search field") { SearchFieldGallery() }
    #Preview("Search field · dark, Amber") { SearchFieldGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Search field · AX3") { SearchFieldGallery().dynamicTypeSize(.accessibility3) }
#endif
