import CraftTokens
import SwiftUI

/// The haptic vocabulary of CraftUI. Each case maps to a SwiftUI `SensoryFeedback`, so components play haptics with
/// `.sensoryFeedback` and never touch UIKit generators. One haptic per meaningful event; never on scroll or typing.
///
///     SaveButton().craftFeedback(.success, trigger: savedCount)
public enum HapticFeedback: Sendable, Equatable, CaseIterable {
    /// A value changed in a picker, chip group or segmented control.
    case selection
    /// A light tick for a press that has no other consequence.
    case tap
    /// A value went up (a stepper increment).
    case increase
    /// A value went down (a stepper decrement).
    case decrease
    /// A switch turned on.
    case toggleOn
    /// A switch turned off.
    case toggleOff
    /// An operation succeeded.
    case success
    /// An approaching limit.
    case warning
    /// An operation failed.
    case error

    /// The SwiftUI feedback this case plays.
    public var sensoryFeedback: SensoryFeedback {
        switch self {
        case .selection: .selection
        case .tap: .impact(weight: .light)
        case .increase: .increase
        case .decrease: .decrease
        case .toggleOn: .impact(flexibility: .rigid)
        case .toggleOff: .impact(flexibility: .soft)
        case .success: .success
        case .warning: .warning
        case .error: .error
        }
    }

    /// The feedback for a switch that just turned to `isOn`.
    public static func toggle(_ isOn: Bool) -> HapticFeedback { isOn ? .toggleOn : .toggleOff }
}

public extension View {
    /// Plays `feedback` each time `trigger` changes. Pass `nil` to stay silent (a caller turned haptics off).
    func craftFeedback<Trigger: Equatable>(_ feedback: HapticFeedback?, trigger: Trigger) -> some View {
        sensoryFeedback(trigger: trigger) { _, _ in feedback?.sensoryFeedback }
    }

    /// Plays the feedback `feedback` returns for a change of `trigger` from old to new, or nothing for `nil`.
    ///
    ///     .craftFeedback(trigger: value) { old, new in new > old ? .increase : .decrease }
    func craftFeedback<Trigger: Equatable>(
        trigger: Trigger, _ feedback: @escaping (Trigger, Trigger) -> HapticFeedback?
    ) -> some View {
        sensoryFeedback(trigger: trigger) { old, new in feedback(old, new)?.sensoryFeedback }
    }
}
