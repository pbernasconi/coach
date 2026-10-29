import KoboTokens
import SwiftUI

/// A raised, translucent surface in both shapes: Liquid Glass (the surface fill under a solid theme), a faint wash that
/// is lighter at the top, a hairline whose top edge catches the light, and a soft wide shadow. At rest a capsule, open
/// a rounded card. One modifier chain for both shapes: a branch would rebuild the field and drop focus.
struct ChatComposerSurface: ViewModifier {
    @Environment(\.koboTheme) private var theme
    @Environment(\.colorScheme) private var colorScheme
    let isExpanded: Bool

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: isExpanded ? Radius.xl : Radius.pill, style: .continuous)
        let isGlass = theme.surfaceStyle == .glass
        content
            .background {
                shape
                    .fill(isGlass ? theme.palette.surface.opacity(0.55) : theme.palette.surface)
                    .overlay {
                        shape.fill(
                            LinearGradient(
                                colors: [
                                    theme.palette.surface.opacity(0.5),
                                    theme.palette.surfaceRaised.opacity(0.35),
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                    }
                    .shadow(color: shadow, radius: Space.xxl / 2, y: Space.sm)
            }
            .glassEffect(isGlass ? .regular : .identity, in: shape)
            .overlay {
                shape.strokeBorder(
                    LinearGradient(
                        colors: [theme.palette.surface, theme.palette.separator],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: Size.hairline
                )
            }
    }

    private var shadow: Color {
        colorScheme == .dark
            ? theme.palette.canvas.opacity(ChatComposerShadow.darkOpacity)
            : theme.palette.textPrimary.opacity(ChatComposerShadow.opacity)
    }
}

/// The composer's shadow strength (a maths constant, not a colour).
enum ChatComposerShadow {
    static let opacity: Double = 0.08
    static let darkOpacity: Double = 0.5
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
