import Foundation

/// The rest the Workout screen starts when a set is logged: what it follows and when it ends. The ViewModel hands it to
/// its `RestActivityController`, which puts the rest on the workout Live Activity.
nonisolated struct RestActivityAttributes: Codable, Hashable, Sendable {
    /// What changes while the rest runs.
    nonisolated struct ContentState: Codable, Hashable, Sendable {
        /// When the rest is over.
        var endsAt: Date
        /// The whole rest in seconds, including time added with +30s.
        var totalSeconds: Int
        /// "Set 3 · 5 @ 100 kg", or nil after the last planned set.
        var nextSetLabel: String?
    }

    /// "Back squat".
    var exerciseName: String
    /// "Set 2": the set just logged.
    var setLabel: String
}
