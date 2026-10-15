import KoboComponents
import KoboTokens
import SwiftUI

/// The animation at the top of an exercise screen, drawn straight on its card with no frame of its own. The dataset's
/// GIFs are 180 × 180 px on pure white, the same white as a light-mode card, so in light mode the figure sits on the
/// card itself. In dark mode the white would glare, so it becomes a soft, slightly dimmed light tile whose corners stay
/// concentric with the card around it. The caller sizes it; it keeps a square.
struct ExerciseMediaHero: View {
    /// The tile's corner radius: concentric with the `Radius.lg` overview card around it.
    static let cornerRadius = Radius.concentric(
        outer: Radius.lg,
        inset: ExerciseOverviewMetrics.padding
    )
    /// How much of the white tile shows over a dark card: enough to read the drawing, without glare.
    static let darkOpacity = 0.86

    @Environment(\.colorScheme) private var colorScheme
    let animation: MediaImage
    /// The exercise name, for VoiceOver ("… animation").
    let name: String

    var body: some View {
        frame
            .aspectRatio(1, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: Self.cornerRadius, style: .continuous))
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
                .opacity(colorScheme == .dark ? Self.darkOpacity : 1)
        }
    }
}

/// What stands in for the animation of an exercise without catalog media: a figure symbol on a soft tile.
struct ExerciseMediaPlaceholder: View {
    @Environment(\.koboTheme) private var theme

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: ExerciseMediaHero.cornerRadius, style: .continuous)
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
