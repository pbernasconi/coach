import Foundation

/// The spring that carries a `BackdropSheet` to a detent: critically damped (no overshoot), starting with the finger's
/// release speed so a flick flows straight into the settle. Values are scroll offsets in points; time is in seconds.
nonisolated public struct BackdropSheetSpring: Equatable, Sendable {
    public let from: Double
    public let to: Double
    /// Points per second, positive when the offset grows (the sheet goes up).
    public let velocity: Double
    /// The perceptual duration, as `Spring(duration:)` means it.
    public let response: Double

    public init(from: Double, to: Double, velocity: Double = 0, response: Double) {
        self.from = from
        self.to = to
        self.velocity = velocity
        self.response = max(response, 0.01)
    }

    private var omega: Double { 2 * .pi / response }

    /// The offset `time` seconds after the start.
    public func value(at time: Double) -> Double {
        let start = from - to
        let push = velocity + omega * start
        return to + (start + push * time) * exp(-omega * time)
    }

    /// The speed `time` seconds after the start, in points per second.
    public func speed(at time: Double) -> Double {
        let start = from - to
        let push = velocity + omega * start
        return (push - omega * (start + push * time)) * exp(-omega * time)
    }

    /// Close enough to the end to stop: under half a point away and slow, or well past the response.
    public func isSettled(at time: Double) -> Bool {
        (abs(value(at: time) - to) < 0.5 && abs(speed(at: time)) < 20) || time > response * 4
    }
}
