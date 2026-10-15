import KoboTokens
import SwiftUI

/// A small glass disc with a glyph, for the corner of a `Thumbnail` (a play glyph on a video). Decorative: say what it
/// means in the thumbnail's or the row's label ("Bench press, has video").
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
            .glassEffect(.regular, in: .circle)
            .accessibilityHidden(true)
    }
}

#Preview("Thumbnail badge") {
    HStack(spacing: Space.md) {
        ThumbnailBadge()
        ThumbnailBadge(systemName: "checkmark")
    }
    .padding()
}

#Preview("Thumbnail badge, dark") {
    ThumbnailBadge().padding().preferredColorScheme(.dark)
}

#Preview("Thumbnail badge, AX3") {
    ThumbnailBadge().padding().dynamicTypeSize(.accessibility3)
}
