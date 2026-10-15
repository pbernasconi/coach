import KoboTokens
import SwiftUI

/// The shared, centred layout of `EmptyState` and `ErrorState`: art (an `EmptyStateArt` disc or an illustration), a
/// title, a message, then actions. Text wraps at every size and nothing has a fixed height, so it holds up at AX3.
struct FeedbackStateLayout<Art: View, Actions: View>: View {
    let art: Art
    let title: Text
    let message: Text?
    let actions: Actions
    @Environment(\.koboTheme) private var theme

    init(art: Art, title: Text, message: Text?, actions: Actions) {
        self.art = art
        self.title = title
        self.message = message
        self.actions = actions
    }

    var body: some View {
        VStack(spacing: Space.lg) {
            art
            VStack(spacing: Space.sm) {
                title
                    .font(theme.font(.title2))
                    .foregroundStyle(theme.palette.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                if let message {
                    message
                        .font(theme.font(.body))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            actions
        }
        .padding(.horizontal, Space.xxl)
        .padding(.vertical, Space.xxxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
