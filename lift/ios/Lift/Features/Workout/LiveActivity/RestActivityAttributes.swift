import ActivityKit
import Foundation

/// The rest countdown as a Live Activity on the Lock Screen and in the Dynamic Island. Compiled by both the app,
/// which starts and updates it, and the LiftWidgets extension, which draws it (see `project.yml`).
nonisolated struct RestActivityAttributes: ActivityAttributes, Codable, Hashable, Sendable {
    /// What changes while the activity runs.
    nonisolated struct ContentState: Codable, Hashable, Sendable {
        /// When the rest is over. The system counts down to it, so the app sends no ticks.
        var endsAt: Date
        /// The whole rest in seconds, including time added with +30s.
        var totalSeconds: Int
        /// "Set 3 · 5 @ 100 kg", or nil after the last planned set.
        var nextSetLabel: String?

        /// When the rest began, for the progress bar.
        var startsAt: Date { endsAt.addingTimeInterval(-TimeInterval(max(0, totalSeconds))) }

        /// The rest as a date range, for `Text(timerInterval:)` and `ProgressView(timerInterval:)`.
        var interval: ClosedRange<Date> { startsAt...endsAt }
    }

    /// "Back squat".
    var exerciseName: String
    /// "Set 2": the set just logged.
    var setLabel: String
}
