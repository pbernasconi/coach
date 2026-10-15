import KoboTokens
import SwiftUI

/// The in-body heading of a flow step: the title (a VoiceOver header) and an optional subtitle. The bar names the
/// flow and this heading says what to do on this step, so the two differ on purpose.
struct FlowStepHeading: View {
    @Environment(\.koboTheme) private var theme
    let title: Text
    let subtitle: Text?

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            title
                .font(theme.font(.title))
                .foregroundStyle(theme.palette.textPrimary)
                .accessibilityAddTraits(.isHeader)
            if let subtitle {
                subtitle
                    .font(theme.font(.body))
                    .foregroundStyle(theme.palette.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
