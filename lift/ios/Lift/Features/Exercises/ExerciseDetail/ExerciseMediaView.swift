import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// The top of the exercise detail screen: the exercise's media with its credit line, or a placeholder when there is
/// none. For now it shows the still thumbnail; playing `media.gifURL` (and holding the thumbnail under Reduce Motion)
/// is left to the media integration.
struct ExerciseMediaView: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var height: CGFloat = 240
    let name: String
    let media: ExerciseMedia?

    var body: some View {
        Group {
            if let media {
                VStack(alignment: .leading, spacing: Space.sm) {
                    AsyncImage(url: media.thumbnailURL) { image in
                        image.resizable().scaledToFit()
                    } placeholder: {
                        placeholder
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: height)
                    .accessibilityLabel(Text(verbatim: String(localized: "\(name), demonstration")))
                    Text(verbatim: media.attribution)
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textSecondary)
                }
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
