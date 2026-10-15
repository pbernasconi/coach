import SwiftUI

/// The closed set of motion presets. Ported from an earlier app's `MotionPreset` (Material 3 timings and
/// critically damped springs), plus the presets the Lift prototype needed (pulse, pop, countdown).
///
/// Rules: animate only direct touch, things entering or leaving, ongoing activity and control state.
/// Exits are faster than entrances. Overshoot only on indicators and glyphs, never on content.
/// Every preset returns `nil` when Reduce Motion is on, so the change applies at once.
public enum Motion: CaseIterable, Sendable {
    /// Pressed-state colour feedback (100 ms).
    case instant
    /// Control state: checkbox fill, switch track, focus ring (150 ms).
    case state
    /// Small entrances: banners, inline reveals (250 ms, decelerate).
    case enter
    /// Overlay entrances: dialogs, action sheets (300 ms).
    case overlay
    /// Every exit (200 ms, accelerate).
    case exit
    /// Indicators only: switch thumb, segmented pill, a check mark. ~11% overshoot.
    case snappy
    /// Sheets, toasts, pages in: critically damped, no overshoot.
    case present
    /// A push: critically damped, slightly faster.
    case navigate
    /// Sheet or overlay out: critically damped, faster than `present`.
    case dismiss
    /// Skeleton or spinner → content cross-fade (150 ms).
    case crossfade
    /// A small move that leaves, or a glyph swap (~9% overshoot).
    case fastSpatial
    /// A small move that arrives or springs back (1.5% overshoot).
    case defaultSpatial
    /// Opacity of a small thing leaving (~100 ms).
    case fastEffects
    /// Opacity of a small thing arriving; a value that swaps (~160 ms).
    case defaultEffects
    /// A completed action's confirmation: scale-in with a little bounce (the prototype's "pop").
    case pop

    /// The animation, or `nil` with Reduce Motion on.
    public func animation(reduceMotion: Bool) -> Animation? { reduceMotion ? nil : animation }

    public var animation: Animation {
        switch self {
        case .instant: .timingCurve(Curve.standard, duration: Duration.instant)
        case .state: .timingCurve(Curve.standard, duration: Duration.state)
        case .enter: .timingCurve(Curve.enter, duration: Duration.enter)
        case .overlay: .timingCurve(Curve.enter, duration: Duration.overlay)
        case .exit: .timingCurve(Curve.exit, duration: Duration.exit)
        case .snappy: .spring(Spring(mass: 1, stiffness: 300, damping: 20))
        case .present: .spring(Spring(mass: 1, stiffness: 360, damping: 38))
        case .navigate: .spring(Spring(mass: 1, stiffness: 630, damping: 51))
        case .dismiss: .spring(Spring(mass: 1, stiffness: 450, damping: 42.4264))
        case .crossfade: .timingCurve(Curve.standard, duration: Duration.crossfade)
        case .fastSpatial: .spring(Spring(mass: 1, stiffness: 800, damping: 33.9411))
        case .defaultSpatial: .spring(Spring(mass: 1, stiffness: 380, damping: 31.1897))
        case .fastEffects: .spring(Spring(mass: 1, stiffness: 3800, damping: 123.2883))
        case .defaultEffects: .spring(Spring(mass: 1, stiffness: 1600, damping: 80))
        case .pop: .spring(response: 0.28, dampingFraction: 0.62)
        }
    }

    /// Timing values, in seconds.
    public enum Duration {
        public static let instant: TimeInterval = 0.10
        public static let state: TimeInterval = 0.15
        public static let enter: TimeInterval = 0.25
        public static let overlay: TimeInterval = 0.30
        public static let exit: TimeInterval = 0.20
        public static let crossfade: TimeInterval = 0.15
        public static let reducedMotionFade: TimeInterval = 0.15
        /// Half a skeleton breath / one pulse half-cycle.
        public static let pulse: TimeInterval = 0.9
        /// A spinner answering a tap shows at least this long, so fast answers still read as an attempt.
        public static let spinnerHold: TimeInterval = 0.3
        /// A save that is still running after this long swaps in a spinner.
        public static let spinnerDelay: TimeInterval = 0.4
        /// Selection fill shown before a picker sheet closes.
        public static let pickHold: TimeInterval = 0.15
        /// A new list row starts fading in after the rows below have moved.
        public static let listRowFadeInDelay: TimeInterval = 0.10
    }

    /// Material 3 easing curves.
    public enum Curve {
        public static let standard = UnitCurve.bezier(startControlPoint: UnitPoint(x: 0.2, y: 0), endControlPoint: UnitPoint(x: 0, y: 1))
        public static let enter = UnitCurve.bezier(startControlPoint: UnitPoint(x: 0.05, y: 0.7), endControlPoint: UnitPoint(x: 0.1, y: 1))
        public static let exit = UnitCurve.bezier(startControlPoint: UnitPoint(x: 0.3, y: 0), endControlPoint: UnitPoint(x: 0.8, y: 0.15))
    }

    /// The error shake.
    public enum Shake {
        public static let distance: CGFloat = 8
        public static let settle: TimeInterval = 0.04
        public static let swing: TimeInterval = 0.08
        public static let swings = 3
    }
}

// MARK: - Transitions

public extension Motion {
    /// Fade in on `enter`, out on the faster `exit`. Identity with Reduce Motion on.
    static func fade(reduceMotion: Bool) -> AnyTransition {
        guard !reduceMotion else { return .identity }
        return .asymmetric(insertion: .opacity.animation(Motion.enter.animation), removal: .opacity.animation(Motion.exit.animation))
    }

    /// A presentation that moves; with Reduce Motion it becomes a short cross-fade instead.
    static func presentation(_ movement: AnyTransition, reduceMotion: Bool) -> AnyTransition {
        reduceMotion ? .opacity.animation(.timingCurve(Curve.standard, duration: Duration.reducedMotionFade)) : movement
    }

    /// A glyph that swaps with a state change.
    static func crossFade(reduceMotion: Bool) -> AnyTransition {
        reduceMotion ? .identity : .opacity.animation(Motion.state.animation)
    }

    /// A live-list row: new rows fade in once the rows below have moved; removed rows fade out fast.
    static func listRow(reduceMotion: Bool) -> AnyTransition {
        guard !reduceMotion else { return .identity }
        let fadeIn = Animation.timingCurve(Curve.standard, duration: Duration.crossfade).delay(Duration.listRowFadeInDelay)
        return .asymmetric(insertion: .opacity.animation(fadeIn), removal: .opacity.animation(Motion.fastEffects.animation))
    }

    /// Scale-and-fade "pop" for confirmations (a check appearing, a badge landing).
    static func pop(reduceMotion: Bool) -> AnyTransition {
        guard !reduceMotion else { return .opacity }
        return .scale(scale: 0.86).combined(with: .opacity).animation(Motion.pop.animation)
    }

    /// Slide up from the bottom edge, for toasts and accessories.
    static func rise(reduceMotion: Bool) -> AnyTransition {
        presentation(.move(edge: .bottom).combined(with: .opacity), reduceMotion: reduceMotion)
    }
}

// MARK: - View helpers

public extension View {
    /// Animates changes to `value` with a preset, honouring Reduce Motion automatically.
    func craftAnimation<V: Equatable>(_ motion: Motion, value: V) -> some View {
        modifier(CraftAnimationModifier(motion: motion, value: value))
    }
}

private struct CraftAnimationModifier<V: Equatable>: ViewModifier {
    let motion: Motion
    let value: V
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content.animation(motion.animation(reduceMotion: reduceMotion), value: value)
    }
}

/// Runs `body` inside a preset animation (or none with Reduce Motion), for state changes in actions.
@MainActor
public func withCraftAnimation<Result>(_ motion: Motion, reduceMotion: Bool, _ body: () throws -> Result) rethrows -> Result {
    try withAnimation(motion.animation(reduceMotion: reduceMotion), body)
}
