import KoboTokens
import SwiftUI

/// What a press does to a tappable view: shrink a little, lay a veil over it, or both.
public enum PressEffect: Sendable, Equatable, CaseIterable {
    /// Scales to `PressMetrics.scale`: cards, tiles, chips.
    case scale
    /// A soft veil over the content, clipped to the press shape: full-width rows, opaque cards.
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

/// A `ButtonStyle` that adds press feedback to any label without changing its look at rest. The highlight veil is
/// drawn over the label (so it shows on opaque cards too) and clipped to `shape`; pass the label's own shape for
/// rounded corners.
///
///     Button(action: open) { CardContent() }.buttonStyle(.pressFeedback)
///     Button(action: open) { Tile() }.pressFeedback(.highlight, in: RoundedRectangle(cornerRadius: Radius.lg))
public struct PressFeedbackStyle: ButtonStyle {
    private let effect: PressEffect
    private let shape: AnyShape

    public init(_ effect: PressEffect = .scale, in shape: some Shape = Rectangle()) {
        self.effect = effect
        self.shape = AnyShape(shape)
    }

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .contentShape(shape)
            .pressEffect(configuration.isPressed, effect: effect, in: shape)
    }
}

extension ButtonStyle where Self == PressFeedbackStyle {
    /// Scale-on-press feedback.
    public static var pressFeedback: PressFeedbackStyle { PressFeedbackStyle() }

    /// Press feedback with a chosen effect, its veil clipped to `shape`.
    public static func pressFeedback(_ effect: PressEffect, in shape: some Shape = Rectangle()) -> PressFeedbackStyle {
        PressFeedbackStyle(effect, in: shape)
    }
}

extension View {
    /// Gives the buttons in this view press feedback (scale and/or highlight). Apply it to a `Button`.
    public func pressFeedback(_ effect: PressEffect = .scale, in shape: some Shape = Rectangle()) -> some View {
        buttonStyle(PressFeedbackStyle(effect, in: shape))
    }

    /// Draws press feedback for `isPressed`. Use it inside your own `ButtonStyle`:
    ///
    ///     configuration.label.pressEffect(configuration.isPressed, in: Capsule())
    public func pressEffect(
        _ isPressed: Bool,
        effect: PressEffect = .scale,
        in shape: some Shape = Rectangle()
    ) -> some View {
        modifier(PressEffectModifier(isPressed: isPressed, effect: effect, shape: AnyShape(shape)))
    }
}

/// The scale follows the finger on `Motion.instant`; the veil is a `pressFill` over the content, so a quick tap still
/// shows it once and it keeps showing (without its fades) under Reduce Motion.
private struct PressEffectModifier: ViewModifier {
    let isPressed: Bool
    let effect: PressEffect
    let shape: AnyShape

    func body(content: Content) -> some View {
        content
            .modifier(VeilIfHighlighted(isPressed: isPressed, isOn: effect.highlights, shape: shape))
            .scaleEffect(effect.scales && isPressed ? PressMetrics.scale : 1)
            .koboAnimation(.instant, value: isPressed)
    }
}

/// The highlight veil, only for effects that highlight.
private struct VeilIfHighlighted: ViewModifier {
    @Environment(\.koboTheme) private var theme
    let isPressed: Bool
    let isOn: Bool
    let shape: AnyShape

    func body(content: Content) -> some View {
        if isOn {
            content.pressFill(isPressed, in: shape, color: theme.palette.pressVeil(true), layer: .over)
        } else {
            content
        }
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
                Button {
                } label: {
                    Text(verbatim: "highlight in a rounded shape")
                        .font(theme.font(.body))
                        .foregroundStyle(theme.palette.onAccent)
                        .frame(maxWidth: .infinity, minHeight: Size.rowMinHeight)
                        .background(theme.palette.accent, in: RoundedRectangle(cornerRadius: Radius.lg))
                }
                .pressFeedback(.highlight, in: RoundedRectangle(cornerRadius: Radius.lg))
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Press feedback") { PressFeedbackGallery() }
    #Preview("Press feedback · dark") { PressFeedbackGallery().preferredColorScheme(.dark) }
    #Preview("Press feedback · AX3") { PressFeedbackGallery().dynamicTypeSize(.accessibility3) }
#endif
