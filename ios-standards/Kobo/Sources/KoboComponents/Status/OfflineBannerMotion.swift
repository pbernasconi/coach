import KoboTokens
import SwiftUI

/// The motion of the offline slot: it opens on `Motion.present` and closes on `Motion.exit`, so the page under the
/// stack moves with it; "No internet connection" cross-fades to "Back online" on `Motion.crossfade`. With Reduce
/// Motion on, the height changes at once and the words keep a short fade (a colour and word fade moves nothing).
enum OfflineBannerMotion {
    /// The animation of a phase change.
    static func change(from old: OfflineBannerPhase, to new: OfflineBannerPhase, reduceMotion: Bool) -> Animation? {
        switch (old.presence == .hidden, new.presence == .hidden) {
        case (true, false): return Motion.present.animation(reduceMotion: reduceMotion)
        case (false, true): return Motion.exit.animation(reduceMotion: reduceMotion)
        default:
            guard old.presence != new.presence else { return nil }
            return reduceMotion ? reducedFade : Motion.crossfade.animation
        }
    }

    /// The banner fades in on `defaultEffects` while its slot opens, and out on the faster `fastEffects`.
    static func transition(reduceMotion: Bool) -> AnyTransition {
        guard !reduceMotion else { return .opacity.animation(reducedFade) }
        return .asymmetric(
            insertion: .opacity.animation(Motion.defaultEffects.animation),
            removal: .opacity.animation(Motion.fastEffects.animation)
        )
    }

    private static var reducedFade: Animation {
        .timingCurve(Motion.Curve.standard, duration: Motion.Duration.reducedMotionFade)
    }
}

/// Moves `phase` with the connection and its two timers. The `task(id:)` lives inside a modifier so a public
/// `some View` extension never exposes SwiftUI's opaque `task` type across modules.
private struct OfflineBannerPhaseModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let isOffline: Bool
    let phase: Binding<OfflineBannerPhase>
    let clock: any Clock<Duration>

    func body(content: Content) -> some View {
        content
            .onChange(of: isOffline, initial: true) { _, offline in
                apply(phase.wrappedValue.connectivityChanged(isOffline: offline))
            }
            .task(id: phase.wrappedValue) {
                guard let wait = phase.wrappedValue.pendingTimer else { return }
                do {
                    try await clock.sleep(for: wait)
                } catch {
                    return  // Cancelled: the phase moved on.
                }
                apply(phase.wrappedValue.timerFired())
            }
    }

    private func apply(_ next: OfflineBannerPhase) {
        let old = phase.wrappedValue
        guard next != old else { return }
        withAnimation(OfflineBannerMotion.change(from: old, to: next, reduceMotion: reduceMotion)) {
            phase.wrappedValue = next
        }
    }
}

extension View {
    /// Moves `phase` with `isOffline`: a drop shows at once, a drop longer than `OfflineBannerPhase.longDropAfter` says
    /// "Back online" when it ends, and that closes after `backOnlineHold`. `clock` is the time source (inject a test
    /// clock in tests). `BannerStack` uses it; call it yourself only to place an `OfflineBanner` somewhere else.
    public func offlineBannerPhase(
        isOffline: Bool,
        phase: Binding<OfflineBannerPhase>,
        clock: any Clock<Duration> = ContinuousClock()
    ) -> some View {
        modifier(OfflineBannerPhaseModifier(isOffline: isOffline, phase: phase, clock: clock))
    }
}
