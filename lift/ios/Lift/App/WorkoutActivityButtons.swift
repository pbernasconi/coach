import Foundation

/// Where the Live Activity's buttons (`WorkoutActivityIntents.swift`) find the app's `WorkoutActivityCenter`. The system
/// makes the intents itself, so nothing can be passed to them through an init; like the composition root, this system
/// entry point is the one exception to injecting everything. `LiftApp.init` hands the center over once the database is
/// open, also when a button launched Lift in the background. App only.
enum WorkoutActivityButtons {
    /// The composition root's center; nil until the app has launched (or when the database failed to open).
    static var center: WorkoutActivityCenter?

    static func logShownSet() async {
        await center?.logShownSet()
    }

    static func showNextSet() async {
        await center?.showNextSet()
    }

    static func extendRest() async {
        await center?.extendRest()
    }

    static func skipRest() async {
        await center?.skipRest()
    }
}
