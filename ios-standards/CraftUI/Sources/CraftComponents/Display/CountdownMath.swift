import Foundation

/// The pure maths behind `CountdownRing`, tested without rendering.
nonisolated enum CountdownMath {
    /// The share of the countdown still left at `now`: 1 at (or before) `start`, 0 at (or after) `end`.
    static func fraction(now: Date, start: Date, end: Date) -> Double {
        let total = end.timeIntervalSince(start)
        guard total > 0 else { return 0 }
        return RingMath.clamp(end.timeIntervalSince(now) / total)
    }

    /// A safe range for `Text(timerInterval:)`, which needs its bounds in order.
    static func interval(start: Date, end: Date) -> ClosedRange<Date> {
        min(start, end)...max(start, end)
    }

    /// The whole countdown, in whole seconds.
    static func totalSeconds(start: Date, end: Date) -> Int {
        max(0, Int(end.timeIntervalSince(start).rounded()))
    }

    /// "3:00", "0:05", "1:02:03": minutes and zero-padded seconds, with hours only when needed.
    static func clockText(seconds: Int) -> String {
        let seconds = max(0, seconds)
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        let secs = seconds % 60
        let paddedSeconds = secs < 10 ? "0\(secs)" : "\(secs)"
        guard hours > 0 else { return "\(minutes):\(paddedSeconds)" }
        let paddedMinutes = minutes < 10 ? "0\(minutes)" : "\(minutes)"
        return "\(hours):\(paddedMinutes):\(paddedSeconds)"
    }

    /// The time left in words for VoiceOver ("1 minute, 23 seconds"); whole seconds, rounded up.
    static func spokenRemaining(now: Date, end: Date) -> String {
        let left = max(0, Int(end.timeIntervalSince(now).rounded(.up)))
        return Duration.seconds(left).formatted(.units(allowed: [.hours, .minutes, .seconds], width: .wide))
    }
}
