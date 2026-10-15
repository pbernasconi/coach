import KoboComponents
import KoboTokens
import SwiftUI

/// The large animation at the top of an exercise screen, with its credit under it. The dataset's GIFs are
/// 180 × 180 px, so the frame is capped at `maxSide` points: big enough to read, never blown up past about twice the
/// file's own size on a 2× screen.
struct ExerciseMediaHero: View {
    static let maxSide: CGFloat = 300

    let animation: MediaImage
    /// The exercise name, for VoiceOver ("… animation").
    let name: String

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            frame
                .aspectRatio(1, contentMode: .fit)
                .frame(maxWidth: Self.maxSide)
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(Text("\(name) animation"))
                .accessibilityAddTraits(.isImage)
        }
    }

    @ViewBuilder private var frame: some View {
        switch animation {
        case .loading: MediaSkeleton()
        case .failed: MediaFailureGlyph()
        case .loaded(let data): AnimatedExerciseImage(data: data, name: name)
        }
    }
}
