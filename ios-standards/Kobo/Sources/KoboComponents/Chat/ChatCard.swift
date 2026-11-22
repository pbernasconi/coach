import KoboTokens
import SwiftUI

extension View {
    /// The calm card of a chat: a fill a step off the conversation's plain background (the raised grey on white in
    /// light mode, the surface on black in dark) and continuous corners, with no edge or shadow. Cards inside a reply
    /// (`ChatEmbedCard`, `ChatActionCard`, `ChatBreakdownCard`, `ChatQuestionCard`, `ChatChangeCard`) use it, so they
    /// read as one family. The content sits one `Space.cardInset` in.
    ///
    ///     VStack { … }.chatCard()
    public func chatCard(padding: CGFloat = Space.cardInset) -> some View {
        modifier(ChatCardModifier(padding: padding))
    }
}

private struct ChatCardModifier: ViewModifier {
    @Environment(\.koboTheme) private var theme
    @Environment(\.colorScheme) private var colorScheme
    let padding: CGFloat

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(theme.palette.chatCardFill(colorScheme), in: shape)
    }
}

extension Palette {
    /// A chat card's fill: a step off the conversation's background, the raised grey on light mode's white and the
    /// surface on dark mode's black.
    func chatCardFill(_ scheme: ColorScheme) -> Color { scheme == .dark ? surface : surfaceRaised }

    /// A fill for something inside a chat card (a picked chip, a tag, a bar's track): the other of the two, so it
    /// stays visible on the card in both modes.
    func chatCardInset(_ scheme: ColorScheme) -> Color { scheme == .dark ? surfaceRaised : surface }
}
