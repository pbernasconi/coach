import KoboTokens
import SwiftUI

/// What a press does to a tappable view: shrink a little, show a highlight behind it, or both.
public enum PressEffect: Sendable, Equatable, CaseIterable {
    /// Scales to `PressMetrics.scale`: cards, tiles, chips.
    case scale
    /// A soft veil behind the content: full-width rows.
    case highlight
    /// Both together.
    case scaleAndHighlight

    var scales: Bool { self != .highlight }
    var highlights: Bool { self != .scale }
}

/// The shared press values, so every control answers a touch the same way.
enum PressMetrics {
    /// How far a pressed control shrinks.
    static let scale: CGFloat = 0.97
    /// The strength of the press veil drawn in the primary ink (darkens in light mode, lightens in dark mode).
    static let veilOpacity: Double = 0.1
}

extension Palette {
    /// The press veil: the primary ink at a low strength while pressed, clear at rest.
    func pressVeil(_ isPressed: Bool) -> Color {
        textPrimary.opacity(isPressed ? PressMetrics.veilOpacity : 0)
    }
}

/// A `ButtonStyle` that adds press feedback to any label without changing its look at rest.
///
///     Button(action: open) { CardContent() }.buttonStyle(.pressFeedback)
public struct PressFeedbackStyle: ButtonStyle {
    private let effect: PressEffect

    public init(_ effect: PressEffect = .scale) {
        self.effect = effect
    }

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .contentShape(Rectangle())
            .pressEffect(configuration.isPressed, effect: effect)
    }
}

extension ButtonStyle where Self == PressFeedbackStyle {
    /// Scale-on-press feedback.
    public static var pressFeedback: PressFeedbackStyle { PressFeedbackStyle() }

    /// Press feedback with a chosen effect.
    public static func pressFeedback(_ effect: PressEffect) -> PressFeedbackStyle { PressFeedbackStyle(effect) }
}

extension View {
    /// Gives the buttons in this view press feedback (scale and/or highlight). Apply it to a `Button`.
    public func pressFeedback(_ effect: PressEffect = .scale) -> some View {
        buttonStyle(PressFeedbackStyle(effect))
    }

    /// Draws press feedback for `isPressed`. Use it inside your own `ButtonStyle`:
    ///
    ///     configuration.label.pressEffect(configuration.isPressed)
    public func pressEffect(_ isPressed: Bool, effect: PressEffect = .scale) -> some View {
        modifier(PressEffectModifier(isPressed: isPressed, effect: effect))
    }
}

private struct PressEffectModifier: ViewModifier {
    @Environment(\.koboTheme) private var theme
    let isPressed: Bool
    let effect: PressEffect

    func body(content: Content) -> some View {
        content
            .background {
                if effect.highlights {
                    Rectangle().fill(theme.palette.pressVeil(isPressed))
                }
            }
            .scaleEffect(effect.scales && isPressed ? PressMetrics.scale : 1)
            .koboAnimation(.instant, value: isPressed)
    }
}

#if DEBUG
    private struct PressSample: View {
        @Environment(\.koboTheme) private var theme
        let effect: PressEffect

        var body: some View {
            Button {
            } label: {
                Text(String(describing: effect))
                    .font(theme.font(.body))
                    .foregroundStyle(theme.palette.textPrimary)
                    .frame(maxWidth: .infinity, minHeight: Size.rowMinHeight)
                    .background(theme.palette.surface, in: RoundedRectangle(cornerRadius: Radius.md))
            }
            .pressFeedback(effect)
        }
    }

    private struct PressFeedbackGallery: View {
        @Environment(\.koboTheme) private var theme

        var body: some View {
            VStack(spacing: Space.lg) {
                PressSample(effect: .scale)
                PressSample(effect: .highlight)
                PressSample(effect: .scaleAndHighlight)
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Press feedback") { PressFeedbackGallery() }
    #Preview("Press feedback · dark") { PressFeedbackGallery().preferredColorScheme(.dark) }
    #Preview("Press feedback · AX3") { PressFeedbackGallery().dynamicTypeSize(.accessibility3) }
#endif
