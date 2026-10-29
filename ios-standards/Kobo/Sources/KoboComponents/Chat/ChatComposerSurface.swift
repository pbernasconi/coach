import KoboTokens
import SwiftUI

/// A raised, calm surface in both shapes: the plain surface fill (white in light mode, one step above the background
/// in dark), a light hairline and a soft wide shadow (light mode only). At rest a capsule, open a rounded card. One
/// modifier chain for both shapes: a branch would rebuild the field and drop focus.
struct ChatComposerSurface: ViewModifier {
    @Environment(\.koboTheme) private var theme
    @Environment(\.colorScheme) private var colorScheme
    let isExpanded: Bool

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: isExpanded ? Radius.xl : Radius.pill, style: .continuous)
        content
            .background {
                shape
                    .fill(theme.palette.surface)
                    .shadow(color: shadow, radius: Space.lg, y: Space.xs)
            }
            .overlay {
                shape.strokeBorder(
                    theme.palette.textPrimary.opacity(colorScheme == .dark ? 0.1 : 0.08),
                    lineWidth: Size.hairline
                )
            }
    }

    private var shadow: Color {
        colorScheme == .dark ? .clear : theme.palette.textPrimary.opacity(ChatComposerShadow.opacity)
    }
}

/// The composer's shadow strength (a maths constant, not a colour).
enum ChatComposerShadow {
    static let opacity: Double = 0.05
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
