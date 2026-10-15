import KoboTokens
import SwiftUI

/// The one search look: a capsule on the field tokens with the search glyph, the query and a clear glyph. Every drawn
/// search control (`SearchField`, its read-only form) uses it, so search has one shape everywhere.
struct SearchPill: ViewModifier {
    @Environment(\.koboTheme) private var theme
    let isFocused: Bool

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, Space.lg)
            .frame(maxWidth: .infinity, minHeight: Size.buttonHeight)
            .background(theme.palette.surface, in: Capsule())
            .overlay {
                Capsule().strokeBorder(
                    isFocused ? theme.palette.accent : theme.palette.separator,
                    lineWidth: isFocused ? Space.xxs : Size.hairline
                )
            }
            .koboAnimation(.state, value: isFocused)
    }
}

/// The leading search glyph. Decorative.
struct SearchGlyph: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var size = Size.iconSm

    var body: some View {
        Image(systemName: "magnifyingglass")
            .font(.system(size: size, weight: .semibold))
            .foregroundStyle(theme.palette.textSecondary)
            .accessibilityHidden(true)
    }
}

/// The round cancel button beside a search pill: clears the query and ends the search.
struct SearchCancelButton: View {
    let action: () -> Void

    var body: some View {
        IconButton(
            "xmark",
            label: Text("Cancel search", bundle: .module),
            style: .tonal,
            size: .regular,
            action: action
        )
    }
}

extension View {
    /// The capsule of a search control.
    func searchPill(isFocused: Bool = false) -> some View {
        modifier(SearchPill(isFocused: isFocused))
    }
}
