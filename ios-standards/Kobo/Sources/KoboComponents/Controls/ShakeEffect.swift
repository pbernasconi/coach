import KoboTokens
import SwiftUI

extension View {
    /// Shakes the view sideways each time `trigger` changes (a wrong code, a rejected value). With Reduce Motion on it
    /// does not move, so pair it with a haptic or a message that carries the error.
    ///
    ///     CodeField(code: $code).shake(trigger: failedAttempts)
    public func shake<Trigger: Equatable>(trigger: Trigger) -> some View {
        modifier(ShakeModifier(trigger: trigger))
    }
}

/// The horizontal error shake: `travel` counts completed shakes. Each whole unit settles out to
/// `Motion.Shake.distance`, swings `Motion.Shake.swings` times from side to side and settles back to rest
/// (`ShakeMath.legs`), over `ShakeMath.duration`.
struct ShakeEffect: GeometryEffect {
    var travel: CGFloat

    nonisolated var animatableData: CGFloat {
        get { travel }
        set { travel = newValue }
    }

    nonisolated func effectValue(size _: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: ShakeMath.offset(progress: travel), y: 0))
    }
}

private struct ShakeModifier<Trigger: Equatable>: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shakes: CGFloat = 0
    let trigger: Trigger

    func body(content: Content) -> some View {
        content
            .modifier(ShakeEffect(travel: shakes))
            .onChange(of: trigger) {
                guard !reduceMotion else { return }
                // A linear sweep of `travel`: the eased legs in `ShakeMath` shape the swings, timed by `Motion.Shake`.
                withAnimation(.linear(duration: ShakeMath.duration)) { shakes += 1 }
            }
    }
}

#if DEBUG
    private struct ShakeGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var attempts = 0

        var body: some View {
            VStack(spacing: Space.lg) {
                Text("Wrong code")
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.danger.ink)
                    .padding(Space.lg)
                    .background(theme.palette.danger.soft, in: Capsule())
                    .shake(trigger: attempts)
                Button("Shake") { attempts += 1 }
                    .buttonStyle(.kobo(.secondary))
            }
            .padding(Space.gutter)
        }
    }

    #Preview("Shake") { ShakeGallery() }
    #Preview("Shake · dark") { ShakeGallery().preferredColorScheme(.dark) }
    #Preview("Shake · AX3") { ShakeGallery().dynamicTypeSize(.accessibility3) }
#endif
