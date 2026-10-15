import Foundation

/// The maths of a `RangeSlider`, apart from SwiftUI: snapping to the step grid, clamping into the bounds, keeping the
/// two thumbs in order, and mapping between values and track positions.
nonisolated enum RangeSliderMath {
    /// One of the two thumbs.
    enum Thumb: Sendable, Equatable {
        case lower
        case upper
    }

    /// Floating-point noise below this is treated as zero.
    static let tolerance = 1e-9

    /// `value` on the step grid anchored at `bounds.lowerBound`, inside `bounds`. The upper bound stays reachable when
    /// it is off the grid. A non-positive step only clamps.
    static func snapped(_ value: Double, step: Double, in bounds: ClosedRange<Double>) -> Double {
        let clamped = min(max(value, bounds.lowerBound), bounds.upperBound)
        guard step > 0 else { return clamped }
        let lastIndex = ((bounds.upperBound - bounds.lowerBound) / step + tolerance).rounded(.down)
        let index = min(((clamped - bounds.lowerBound) / step).rounded(), lastIndex)
        let grid = cleaned(bounds.lowerBound + index * step)
        // Between the last grid line and an off-grid upper bound, the nearer of the two wins.
        return abs(bounds.upperBound - clamped) < abs(clamped - grid) ? bounds.upperBound : grid
    }

    /// A caller's range, snapped and clamped into `bounds`, with the thumbs in order.
    static func normalized(_ range: ClosedRange<Double>, bounds: ClosedRange<Double>, step: Double) -> ClosedRange<Double> {
        let lower = snapped(range.lowerBound, step: step, in: bounds)
        let upper = snapped(range.upperBound, step: step, in: bounds)
        return min(lower, upper)...max(lower, upper)
    }

    /// The range after `thumb` moves to `value`. A thumb never passes the other one: it stops where the other sits.
    static func moved(
        _ thumb: Thumb,
        to value: Double,
        range: ClosedRange<Double>,
        bounds: ClosedRange<Double>,
        step: Double
    ) -> ClosedRange<Double> {
        let current = normalized(range, bounds: bounds, step: step)
        let target = snapped(value, step: step, in: bounds)
        switch thumb {
        case .lower: return min(target, current.upperBound)...current.upperBound
        case .upper: return current.lowerBound...max(target, current.lowerBound)
        }
    }

    /// The range after one adjustable step of `thumb` (VoiceOver swipe up or down).
    static func stepped(
        _ thumb: Thumb,
        up: Bool,
        range: ClosedRange<Double>,
        bounds: ClosedRange<Double>,
        step: Double
    ) -> ClosedRange<Double> {
        let current = normalized(range, bounds: bounds, step: step)
        let from = thumb == .lower ? current.lowerBound : current.upperBound
        let by = step > 0 ? step : (bounds.upperBound - bounds.lowerBound) / 10
        return moved(thumb, to: from + (up ? by : -by), range: current, bounds: bounds, step: step)
    }

    /// Which thumb a drag moves. While the thumbs sit on one value, the drag's direction picks: towards the lower bound
    /// moves the lower thumb, otherwise the upper one, so two thumbs stacked at an end never get stuck.
    static func thumb(grabbed: Thumb, toward value: Double, range: ClosedRange<Double>) -> Thumb {
        guard abs(range.upperBound - range.lowerBound) < tolerance else { return grabbed }
        return value < range.lowerBound ? .lower : .upper
    }

    /// Where `value` sits along the track, from 0 at the lower bound to 1 at the upper one.
    static func fraction(of value: Double, in bounds: ClosedRange<Double>) -> Double {
        let span = bounds.upperBound - bounds.lowerBound
        guard span > 0 else { return 0 }
        return min(max((value - bounds.lowerBound) / span, 0), 1)
    }

    /// The value at a track position from 0 to 1 (clamped).
    static func value(atFraction fraction: Double, in bounds: ClosedRange<Double>) -> Double {
        let share = min(max(fraction, 0), 1)
        return bounds.lowerBound + share * (bounds.upperBound - bounds.lowerBound)
    }

    private static func cleaned(_ value: Double) -> Double {
        (value * 1e9).rounded() / 1e9
    }
}
