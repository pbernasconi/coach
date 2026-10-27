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

/// The dock's opaque, raised panel: full width, rounded only at the top, and run down under the home indicator to
/// the bottom of the screen. Light mode: white with a soft shadow cast upwards over the grey canvas. Dark mode: the
/// raised grey, a tone above the set cards, since a shadow does not read on black. A hairline edges both; once the
/// rest is over the edge turns the accent orange. While resting the panel takes the accent's soft tint.
struct WorkoutDockPanel: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.colorScheme) private var colorScheme
    var isReady = false
    var isResting = false

    static let shape = UnevenRoundedRectangle(
        topLeadingRadius: Radius.xl,
        topTrailingRadius: Radius.xl,
        style: .continuous
    )

    var body: some View {
        let shape = Self.shape
        shape
            .fill(base)
            .overlay { if isResting { shape.fill(theme.palette.accentSoft) } }  // soft accent is see-through
            .overlay {
                shape.strokeBorder(
                    isReady ? theme.palette.accent : theme.palette.separator,
                    lineWidth: isReady ? Size.hairline * 3 : Size.hairline
                )
            }
            .shadow(color: theme.palette.scrim, radius: Space.lg, y: -Space.xs)
    }

    /// Opaque, so the set rows never show through.
    private var base: Color {
        colorScheme == .dark ? theme.palette.surfaceRaised : theme.palette.surface
    }
}

/// The strip across the top of the dock that names a state no set has: "Resting" (accent, "after Back squat" when the
/// rest follows an exercise's last set), "Rest over +0:12" (soft
/// accent) and "Paused at 12:47" (dark). Nothing while lifting.
struct WorkoutDockBand: View {
    @Environment(\.koboTheme) private var theme
    let phase: WorkoutDockPhase
    /// The exercise a rest between two exercises follows: "Resting · after Back squat".
    var restAfter: String? = nil

    var body: some View {
        switch phase {
        case .resting:
            band(
                Text("Resting"),
                icon: "timer",
                detail: restAfter.map { Text("after \($0)") },
                ink: theme.palette.onAccent,
                fill: theme.palette.accent
            )
        case .ready(_, let ready, _):
            band(
                Text("Rest over"),
                icon: "timer",
                detail: Text("+\(ready.since, style: .timer)"),
                ink: theme.palette.accentText,
                fill: theme.palette.accentSoft
            )
        case .paused(_, let elapsed):
            band(
                Text("Paused"),
                icon: "pause.fill",
                detail: Text("at \(WorkoutClock.text(seconds: elapsed))"),
                ink: theme.palette.surface,
                fill: theme.palette.textPrimary
            )
            .accessibilityValue(Text(verbatim: WorkoutClock.spoken(seconds: elapsed)))
        case .start, .lifting, .complete:
            EmptyView()
        }
    }

    private func band(_ title: Text, icon: String, detail: Text?, ink: Color, fill: Color) -> some View {
        HStack(spacing: Space.xs) {
            Image(systemName: icon).accessibilityHidden(true)
            title
                .font(theme.font(.caption).weight(.heavy))
                .textCase(.uppercase)
            Spacer(minLength: Space.sm)
            if let detail {
                detail.font(theme.font(.caption).weight(.semibold).monospacedDigit()).lineLimit(1)
            }
        }
        .font(theme.font(.caption))
        .foregroundStyle(ink)
        .padding(.horizontal, Space.cardInset)
        .padding(.vertical, Space.sm)
        .frame(maxWidth: .infinity)
        .background(fill)
        .accessibilityElement(children: .combine)
    }
}

/// While resting: what comes next, the time rested in large digits against the rest's length ("0:36 / 2:00"), and
/// Skip.
struct WorkoutDockRest: View {
    @Environment(\.koboTheme) private var theme
    let content: WorkoutActivityAttributes.ContentState
    let rest: RestTimer
    let send: (WorkoutAction) -> Void

    var body: some View {
        HStack(alignment: .bottom, spacing: Space.md) {
            VStack(alignment: .leading, spacing: Space.xxs) {
                if let set = content.current {
                    Text("Next: \(set.loadText)")  // the row above already names the set
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                        .lineLimit(1)
                }
                HStack(alignment: .firstTextBaseline, spacing: Space.xs) {
                    Text(verbatim: rest.elapsedText)
                        .font(theme.font(.largeTitle).weight(.bold).monospacedDigit())
                        .foregroundStyle(theme.palette.accentText)
                        .contentTransition(.numericText(value: Double(rest.elapsed)))
                        .koboAnimation(.state, value: rest.elapsed)
                    Text(verbatim: "/ \(rest.totalText)")
                        .font(theme.font(.title2).weight(.semibold).monospacedDigit())
                        .foregroundStyle(theme.palette.textSecondary)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(Text("Rested \(rest.elapsedText) of \(rest.totalText)"))
                .accessibilityAddTraits(.updatesFrequently)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button("Skip") { send(.restSkipTapped) }
                .buttonStyle(.kobo(.primary))
                .accessibilityLabel(Text("Skip rest"))
        }
    }
}
