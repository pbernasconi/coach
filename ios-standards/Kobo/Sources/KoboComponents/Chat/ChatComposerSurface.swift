import KoboTokens
import SwiftUI

/// The composer's surface, matched to the Claude iPhone app: a warm off-white fill (`palette.composer`), a bright 1 pt
/// edge that catches the light and a soft, wide shadow, dropped a little. At rest a capsule, open a card with 24 pt
/// corners. One modifier chain for both shapes: a branch would rebuild the field and drop focus.
struct ChatComposerSurface: ViewModifier {
    @Environment(\.koboTheme) private var theme
    let isExpanded: Bool

    func body(content: Content) -> some View {
        let colors = theme.palette.composer
        let shape = RoundedRectangle(cornerRadius: isExpanded ? ChatComposerMetrics.cardRadius : Radius.pill)
        content
            .background {
                shape
                    .fill(colors.fill)
                    .shadow(color: colors.shadow, radius: Space.xxl, y: Space.xs)
            }
            .overlay { shape.strokeBorder(colors.edge, lineWidth: ChatComposerMetrics.edge) }
    }
}

/// The composer's measures, taken from the Claude app at 3x: the edge, the card's corners, and the gap left between
/// the round buttons once their 44 pt targets touch (9 pt between the circles).
enum ChatComposerMetrics {
    /// The bright edge: one point, drawn inside.
    static let edge: CGFloat = 1
    static let cardRadius: CGFloat = Space.xxl
    static let buttonGap: CGFloat = 1
}

/// The screen's colour behind the composer, fading in over its top edge and running under the home indicator.
struct ChatComposerBackdrop: View {
    let color: Color?

    var body: some View {
        if let color {
            LinearGradient(
                stops: [.init(color: color.opacity(0), location: 0), .init(color: color.opacity(0.6), location: 0.5)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea(edges: .bottom)
            .allowsHitTesting(false)
        }
    }
}
