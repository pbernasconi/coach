import KoboTokens
import SwiftUI

extension KoboButtonStyle {
    /// The visual weight of a button. Pick one prominent action per screen.
    public enum Variant: Sendable, Equatable, CaseIterable {
        /// The accent fill: the one main action.
        case primary
        /// A neutral raised fill: a secondary action next to a primary.
        case secondary
        /// The soft accent tint with accent ink: an action that should stand out less than primary.
        case tonal
        /// Liquid Glass: controls floating over content or media.
        case glass
        /// The danger fill: an action that deletes or cannot be undone.
        case destructive
        /// Ink only, no fill: inline and tertiary actions.
        case plain
    }

    /// The height class of a button.
    public enum Size: Sendable, Equatable, CaseIterable {
        /// `Size.buttonHeight` (50pt): the default for screen actions.
        case regular
        /// `Size.buttonHeightCompact` (36pt), padded to a 44pt target: inline and toolbar actions.
        case compact
        /// A 44pt circle for an icon-only label (give the button an accessibility label).
        case icon

        var height: CGFloat {
            switch self {
            case .regular: KoboTokens.Size.buttonHeight
            case .compact: KoboTokens.Size.buttonHeightCompact
            case .icon: KoboTokens.Size.minTouch
            }
        }

        var horizontalPadding: CGFloat {
            switch self {
            case .regular: Space.xl
            case .compact: Space.lg
            case .icon: 0
            }
        }

        /// The extra space above and below the visible shape that brings the target to `Size.minTouch`.
        var targetInset: CGFloat { max(KoboTokens.Size.minTouch - height, 0) / 2 }

        var fontRole: Typography.Role {
            self == .compact ? .subheadline : .headline
        }
    }

    /// How wide a button is: its label's width, or the full width it is offered.
    public enum Width: Sendable, Equatable, CaseIterable {
        case hug, full
    }
}

/// The resolved colours of one button state. A disabled button draws the palette's disabled roles, never an opacity.
struct ButtonLook: Equatable {
    var fill: Color
    var foreground: Color

    static func resolve(_ variant: KoboButtonStyle.Variant, palette: Palette, isEnabled: Bool) -> ButtonLook {
        guard isEnabled else { return disabled(variant, palette: palette) }
        switch variant {
        case .primary: return ButtonLook(fill: palette.accent, foreground: palette.onAccent)
        case .secondary: return ButtonLook(fill: palette.surfaceRaised, foreground: palette.textPrimary)
        case .tonal: return ButtonLook(fill: palette.accentSoft, foreground: palette.accentText)
        case .glass: return ButtonLook(fill: .clear, foreground: palette.textPrimary)
        case .destructive: return ButtonLook(fill: palette.danger.ink, foreground: palette.surface)
        case .plain: return ButtonLook(fill: .clear, foreground: palette.accentText)
        }
    }

    private static func disabled(_ variant: KoboButtonStyle.Variant, palette: Palette) -> ButtonLook {
        switch variant {
        case .primary, .secondary, .tonal, .destructive:
            ButtonLook(fill: palette.surfaceRaised, foreground: palette.textTertiary)
        case .glass, .plain:
            ButtonLook(fill: .clear, foreground: palette.textTertiary)
        }
    }
}
