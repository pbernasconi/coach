import KoboTokens
import SwiftUI

/// Text with the parts that match a search in bold, so a result shows why it matched. Matching ignores case and
/// diacritics and works word by word (`SearchMatch`): "creme bru" bolds "Crème" and "brû" in "Crème brûlée".
///
///     HighlightedText(recipe.name, query: query)
///     HighlightedText(result.element.name, ranges: result.match.ranges)
public struct HighlightedText: View {
    private let text: String
    private let ranges: [Range<String.Index>]

    /// `text` with every word of `query` in bold. A blank or missing query bolds nothing.
    public init(_ text: String, query: String) {
        self.text = text
        ranges = SearchMatch(text, query: query)?.ranges ?? []
    }

    /// `text` with `ranges` (indices into `text`, from a `SearchMatch`) in bold.
    public init(_ text: String, ranges: [Range<String.Index>]) {
        self.text = text
        self.ranges = ranges
    }

    public var body: some View {
        Text(attributed)
    }

    private var attributed: AttributedString {
        var attributed = AttributedString(text)
        for range in ranges where range.upperBound <= text.endIndex {
            guard let target = Range<AttributedString.Index>(range, in: attributed) else { continue }
            attributed[target].inlinePresentationIntent = .stronglyEmphasized
        }
        return attributed
    }
}

#if DEBUG
    private struct HighlightedTextGallery: View {
        @Environment(\.koboTheme) private var theme

        var body: some View {
            VStack(alignment: .leading, spacing: Space.md) {
                HighlightedText("Mushroom Risotto", query: "risotto mush")
                HighlightedText("Crème brûlée", query: "creme bru")
                HighlightedText("Lemon Tart", query: "")
                HighlightedText("Miso soup", query: "soup")
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textSecondary)
            }
            .padding(Space.gutter)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Highlighted text") { HighlightedTextGallery() }
    #Preview("Highlighted text · dark") { HighlightedTextGallery().preferredColorScheme(.dark) }
    #Preview("Highlighted text · AX3") { HighlightedTextGallery().dynamicTypeSize(.accessibility3) }
#endif
