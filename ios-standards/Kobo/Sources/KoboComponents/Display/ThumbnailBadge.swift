import KoboTokens
import SwiftUI

/// A small disc with a glyph, for the corner of a `Thumbnail` (a play glyph on a video): Liquid Glass under a glass
/// theme, the raised surface under a `.solid` one. Decorative: say what it means in the thumbnail's or the row's label
/// ("Bench press, has video").
public struct ThumbnailBadge: View {
    private let systemName: String
    @Environment(\.koboTheme) private var theme

    public init(systemName: String = "play.fill") {
        self.systemName = systemName
    }

    public var body: some View {
        Image(systemName: systemName)
            .font(theme.font(.caption).weight(.bold))
            .imageScale(.small)
            .foregroundStyle(theme.palette.textPrimary)
            .frame(width: Size.iconLg, height: Size.iconLg)
            .modifier(BadgeSurface())
            .accessibilityHidden(true)
    }
}

/// Glass yields to a `.solid` theme (CONVENTIONS rule 16).
private struct BadgeSurface: ViewModifier {
    @Environment(\.koboTheme) private var theme

    func body(content: Content) -> some View {
        switch theme.surfaceStyle {
        case .glass: content.glassEffect(.regular, in: .circle)
        case .solid: content.background(theme.palette.surfaceRaised, in: Circle())
        }
    }
}

#if DEBUG
    #Preview("Thumbnail badge") {
        HStack(spacing: Space.md) {
            ThumbnailBadge()
            ThumbnailBadge(systemName: "checkmark")
        }
        .padding()
    }

    #Preview("Thumbnail badge, dark, solid") {
        ThumbnailBadge().padding().koboTheme(Theme(palette: .amber, surfaceStyle: .solid)).preferredColorScheme(.dark)
    }

    #Preview("Thumbnail badge, AX3") {
        ThumbnailBadge().padding().dynamicTypeSize(.accessibility3)
    }
#endif
