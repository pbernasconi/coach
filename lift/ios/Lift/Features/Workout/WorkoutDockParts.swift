import KoboComponents
import KoboTokens
import SwiftUI

/// The current exercise's sets as dots, as on the Lock Screen: filled when logged, a ring on the set to do now.
struct WorkoutDockDots: View {
    @Environment(\.koboTheme) private var theme
    let dots: [WorkoutActivityDot]
    private let size = Space.sm

    var body: some View {
        HStack(spacing: size * 0.6) {
            ForEach(Array(dots.prefix(12).enumerated()), id: \.offset) { _, dot in
                switch dot {
                case .done:
                    Circle().fill(theme.palette.accent).frame(width: size, height: size)
                case .current:
                    Circle().strokeBorder(theme.palette.accentText, lineWidth: 2).frame(width: size * 1.35, height: size * 1.35)
                case .skipped:
                    Circle().fill(theme.palette.textTertiary.opacity(0.5)).frame(width: size, height: size)
                case .planned:
                    Circle().strokeBorder(theme.palette.textTertiary, lineWidth: 1).frame(width: size, height: size)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("\(dots.count(where: { $0 == .done })) of \(dots.count) sets logged"))
    }
}

/// The dock's opaque, raised panel. Light mode: a white card with a soft shadow over the grey canvas. Dark mode:
/// the raised grey, a tone above the set cards, since a shadow does not read on black. A hairline edges both; once the
/// rest is over the edge turns amber.
struct WorkoutDockPanel: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.colorScheme) private var colorScheme
    var isReady = false

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Radius.xl, style: .continuous)
        shape
            .fill(colorScheme == .dark ? theme.palette.surfaceRaised : theme.palette.surface)
            .overlay {
                shape.strokeBorder(
                    isReady ? theme.palette.accent : theme.palette.separator,
                    lineWidth: isReady ? Size.hairline * 3 : Size.hairline
                )
            }
            .shadow(color: theme.palette.scrim, radius: Space.lg, y: Space.xs)
    }
}
