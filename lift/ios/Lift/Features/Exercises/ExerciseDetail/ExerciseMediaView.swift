import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// The top of the exercise detail screen: the exercise's animation (its first frame, still, under Reduce Motion) with
/// the "© Gym visual" credit, or a placeholder when the exercise has no catalog media.
struct ExerciseMediaView: View {
    @Environment(\.koboTheme) private var theme
    let name: String
    let media: ExerciseMedia?
    /// The loaded animation behind `media`.
    let animation: MediaImage

    var body: some View {
        Group {
            if media != nil {
                ExerciseMediaHero(animation: animation, name: name)
            } else {
                placeholder
                    .padding(.vertical, Space.xxl)
            }
        }
        .koboCard()
    }

    private var placeholder: some View {
        VStack(spacing: Space.sm) {
            Image(systemName: "figure.strengthtraining.traditional")
                .font(theme.font(.largeTitle))
                .foregroundStyle(theme.palette.textTertiary)
                .accessibilityHidden(true)
            Text("No illustration yet")
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }
}
