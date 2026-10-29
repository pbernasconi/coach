import KoboTokens
import SwiftUI

extension View {
    /// The calm card of a chat: the surface fill, a hairline edge and continuous corners, with no shadow. Cards inside
    /// a reply (`ChatEmbedCard`, `ChatActionCard`, `ChatBreakdownCard`, `ChatQuestionCard`) use it, so they read as
    /// one family on the conversation's plain background. The content sits one `Space.cardInset` in.
    ///
    ///     VStack { … }.chatCard()
    public func chatCard(padding: CGFloat = Space.cardInset) -> some View {
        modifier(ChatCardModifier(padding: padding))
    }
}

private struct ChatCardModifier: ViewModifier {
    @Environment(\.koboTheme) private var theme
    let padding: CGFloat

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(theme.palette.surface, in: shape)
            .overlay { shape.strokeBorder(theme.palette.separator, lineWidth: Size.hairline * 2) }
    }
}
