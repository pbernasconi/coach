import CraftTokens
import SwiftUI

public extension View {
    /// Shakes the view sideways each time `trigger` changes (a wrong code, a rejected value). With Reduce Motion on it
    /// does not move, so pair it with a haptic or a message that carries the error.
    ///
    ///     CodeField(code: $code).shake(trigger: failedAttempts)
    func shake<Trigger: Equatable>(trigger: Trigger) -> some View {
        modifier(ShakeModifier(trigger: trigger))
    }
}

/// The horizontal error shake: `travel` counts completed shakes, and each whole unit swings `Motion.Shake.swings`
/// times out to `Motion.Shake.distance` and back to rest.
struct ShakeEffect: GeometryEffect {
    var travel: CGFloat

    nonisolated var animatableData: CGFloat {
        get { travel }
        set { travel = newValue }
    }

    nonisolated func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: Self.offset(progress: travel), y: 0))
    }

    /// The sideways offset at `progress` shakes in: zero at every whole number, so the view always ends at rest.
    nonisolated static func offset(progress: CGFloat) -> CGFloat {
        let swings = CGFloat(Motion.Shake.swings)
        return Motion.Shake.distance * sin(progress * swings * 2 * .pi)
    }

    /// One shake lasts its swings plus a settle at each end.
    nonisolated static var duration: TimeInterval {
        Motion.Shake.settle * 2 + Motion.Shake.swing * Double(Motion.Shake.swings)
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
                // A linear sweep of `travel`: the sine in `ShakeEffect` shapes the swings, timed by `Motion.Shake`.
                withAnimation(.linear(duration: ShakeEffect.duration)) { shakes += 1 }
            }
    }
}

#if DEBUG
private struct ShakeGallery: View {
    @Environment(\.craftTheme) private var theme
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
                .buttonStyle(.craft(.secondary))
        }
        .padding(Space.gutter)
    }
}

#Preview("Shake") { ShakeGallery() }
#Preview("Shake · dark") { ShakeGallery().preferredColorScheme(.dark) }
#Preview("Shake · AX3") { ShakeGallery().dynamicTypeSize(.accessibility3) }
#endif
