import KoboComponents
import KoboTokens
import SwiftUI

/// The breathing block shown while media loads. Hidden from VoiceOver; the container says what is loading.
struct MediaSkeleton: View {
    var body: some View {
        Skeleton(.block)
            .skeletonBreath()
    }
}

/// What stands in for media that could not load: a figure symbol on a soft tile.
struct MediaFailureGlyph: View {
    @Environment(\.koboTheme) private var theme

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radius.sm, style: .continuous)
                .fill(theme.palette.surfaceSunken)
            Image(systemName: "figure.strengthtraining.traditional")
                .font(theme.font(.title2))
                .foregroundStyle(theme.palette.textTertiary)
                .accessibilityHidden(true)
        }
    }
}
