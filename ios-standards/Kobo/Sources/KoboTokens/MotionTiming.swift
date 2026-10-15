import Foundation

// Motion timings and shake values are plain numbers with no SwiftUI types, so logic that schedules work
// (AsyncButton, ToastCenter) and its tests build anywhere, including Linux CI.
extension Motion {
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

    /// The error shake.
    public enum Shake {
        public static let distance: CGFloat = 8
        public static let settle: TimeInterval = 0.04
        public static let swing: TimeInterval = 0.08
        public static let swings = 3
    }
}
