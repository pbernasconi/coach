import CraftTokens
import SwiftUI

/// The shared, centred layout of `EmptyState` and `ErrorState`: a glyph, a title, a message, then actions.
/// Text wraps at every size and nothing has a fixed height, so it holds up at AX3.
struct FeedbackStateLayout<Actions: View>: View {
    let symbol: String
    let symbolTone: Tone
    let title: Text
    let message: Text?
    let actions: Actions
    @Environment(\.craftTheme) private var theme
    @ScaledMetric(relativeTo: .largeTitle) private var discSide = Size.thumbnail

    init(symbol: String, symbolTone: Tone, title: Text, message: Text?, actions: Actions) {
        self.symbol = symbol
        self.symbolTone = symbolTone
        self.title = title
        self.message = message
        self.actions = actions
    }

    init(symbol: String, symbolTone: Tone, title: Text, message: Text?, @ViewBuilder actions: () -> Actions) {
        self.init(symbol: symbol, symbolTone: symbolTone, title: title, message: message, actions: actions())
    }

    var body: some View {
        VStack(spacing: Space.lg) {
            Image(systemName: symbol)
                .font(theme.font(.title2))
                .foregroundStyle(theme.palette.status(symbolTone).ink)
                .frame(width: discSide, height: discSide)
                .background(theme.palette.status(symbolTone).soft, in: Circle())
                .accessibilityHidden(true)
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
