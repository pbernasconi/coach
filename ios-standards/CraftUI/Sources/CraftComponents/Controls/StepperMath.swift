import Foundation

/// The pure maths behind `StepperField` and `QuickPickRow`: clamping, stepping on a grid and nearby values.
/// Steps snap to the grid `range.lowerBound + k × step`, so 21 stepped up by 2.5 from 0 lands on 22.5, not 23.5.
nonisolated enum StepperMath {
    /// Which way a step goes.
    enum Direction: Sendable, Equatable {
        case down, up
    }

    /// Below this, two values count as equal (absorbs floating-point noise such as 0.1 + 0.2).
    static let tolerance = 1e-9

    /// `value` limited to `range`.
    static func clamped(_ value: Double, to range: ClosedRange<Double>) -> Double {
        min(max(value, range.lowerBound), range.upperBound)
    }

    /// The next grid value from `value` in `direction`, clamped to `range`. A value off the grid snaps to the
    /// nearest grid line in that direction. A non-positive step leaves the value clamped but unchanged.
    static func stepped(_ value: Double, by step: Double, _ direction: Direction, in range: ClosedRange<Double>)
        -> Double
    {
        guard step > 0 else { return clamped(value, to: range) }
        let anchor = range.lowerBound
        let position = (value - anchor) / step
        let index: Double =
            switch direction {
            case .up: (position + tolerance).rounded(.down) + 1
            case .down: (position - tolerance).rounded(.up) - 1
            }
        return clamped(cleaned(anchor + index * step), to: range)
    }

    /// Whether a step in `direction` would change the value.
    static func canStep(_ value: Double, by step: Double, _ direction: Direction, in range: ClosedRange<Double>) -> Bool
    {
        abs(stepped(value, by: step, direction, in: range) - clamped(value, to: range)) > tolerance
    }

    /// `count` grid values centred on `value` (snapped to the grid), slid to stay inside `range`, in ascending order.
    /// Near a bound the window shifts instead of shrinking; a range too small for `count` returns every grid value.
    ///
    ///     nearby(100, step: 5, count: 5, in: 0...500)  // [90, 95, 100, 105, 110]
    ///     nearby(0, step: 5, count: 5, in: 0...500)    // [0, 5, 10, 15, 20]
    static func nearby(_ value: Double, step: Double, count: Int, in range: ClosedRange<Double>) -> [Double] {
        guard step > 0, count > 0 else { return [] }
        let anchor = range.lowerBound
        let lastIndex = Int(((range.upperBound - anchor) / step + tolerance).rounded(.down))
        let centre = Int(((clamped(value, to: range) - anchor) / step).rounded())
        let first = min(max(centre - (count - 1) / 2, 0), max(lastIndex - count + 1, 0))
        let last = min(first + count - 1, lastIndex)
        guard first <= last else { return [] }
        return (first...last).map { cleaned(anchor + Double($0) * step) }
    }

    /// Rounds away binary noise (0.30000000000000004 → 0.3) without touching real precision.
    static func cleaned(_ value: Double) -> Double {
        (value * cleaningScale).rounded() / cleaningScale
    }

    /// The precision `cleaned` keeps: nine decimal places (1e9 is exact in binary, so the division rounds correctly).
    private static let cleaningScale = 1e9
}
