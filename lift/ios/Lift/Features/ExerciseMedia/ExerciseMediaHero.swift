import KoboComponents
import KoboTokens
import SwiftUI

/// The animation at the top of an exercise screen, on its card. The dataset's GIFs are 180 × 180 px on pure white, the
/// same white as a light-mode card, so in light mode the figure sits on the card itself. In dark mode it is a deliberate
/// tile: the same rounded tile and the same dimming as every exercise thumbnail (`ExerciseMediaStyle`), so no screen
/// shows a glaring white square. The caller sizes it; it keeps a square.
///
/// The animation is drawn frame by frame as the dataset made it. Its frames are opaque and fully composited, and nothing
/// in the app blends or cross-fades between them; the soft double figure between the two poses is the dataset's own
/// in-between frames (the GIF cross-fades from standing to squatting), not a decoding fault.
struct ExerciseMediaHero: View {
    @Environment(\.colorScheme) private var colorScheme
    let animation: MediaImage
    /// The exercise name, for VoiceOver ("… animation").
    let name: String

    var body: some View {
        frame
            .aspectRatio(1, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: ExerciseMediaStyle.cornerRadius, style: .continuous))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Text("\(name) animation"))
            .accessibilityAddTraits(.isImage)
    }

    @ViewBuilder private var frame: some View {
        switch animation {
        case .loading:
            MediaSkeleton()
        case .failed:
            MediaFailureGlyph()
        case .loaded(let data):
            AnimatedExerciseImage(data: data, name: name)
                .opacity(colorScheme == .dark ? ExerciseMediaStyle.darkOpacity : 1)
        }
    }
}

/// What stands in for the animation of an exercise without catalog media: a figure symbol on a soft tile.
struct ExerciseMediaPlaceholder: View {
    @Environment(\.koboTheme) private var theme

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: ExerciseMediaStyle.cornerRadius, style: .continuous)
                .fill(theme.palette.surfaceSunken)
            VStack(spacing: Space.xs) {
                Image(systemName: "figure.strengthtraining.traditional")
                    .font(theme.font(.title2))
                    .foregroundStyle(theme.palette.textTertiary)
                    .accessibilityHidden(true)
                Text("No illustration yet")
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textSecondary)
                    .multilineTextAlignment(.center)
            }
            .padding(Space.sm)
        }
        .aspectRatio(1, contentMode: .fit)
    }
}

/// The one look of exercise media on every screen: a rounded tile with the thumbnails' largest corner radius, and in
/// dark mode the white drawing dimmed to a soft light grey, so thumbnails in lists, on the Workout screen and the
/// animation on the exercise screens all match.
enum ExerciseMediaStyle {
    /// The tile's corner radius: `Radius.md`, the radius of a full-size `Thumbnail`.
    static let cornerRadius = Radius.md
    /// How much of the white drawing shows over a dark surface: enough to read it, without glare.
    static let darkOpacity = 0.7
}
