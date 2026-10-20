import AppIntents
import Foundation

// The workout Live Activity's buttons. Each is a `LiveActivityIntent`: the system runs it in Lift's process in the
// background, launching Lift when it is not running, without opening the app or unlocking the phone. Compiled into the
// app and LiftWidgets (whose buttons name them); in the extension (`LIFT_EXTENSION`) they do nothing, because the
// system never runs them there. In the app they reach the composition root's `WorkoutActivityCenter` through
// `WorkoutActivityButtons` and write through the same repository as the Workout screen (PLAT-2). They carry no
// parameters: Done and Next act on the set the Live Activity shows.

/// Done: logs the set shown and starts its exercise's rest, like a tick in the app.
nonisolated struct LogSetIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Log the set"
    static let isDiscoverable = false

    func perform() async throws -> some IntentResult {
        #if !LIFT_EXTENSION
            await WorkoutActivityButtons.logShownSet()
        #endif
        return .result()
    }
}

/// Next: shows the following planned set without logging the one shown.
nonisolated struct ShowNextSetIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Show the next set"
    static let isDiscoverable = false

    func perform() async throws -> some IntentResult {
        #if !LIFT_EXTENSION
            await WorkoutActivityButtons.showNextSet()
        #endif
        return .result()
    }
}

/// +30s on the rest; the Workout screen's rest bar follows it.
nonisolated struct AddRestTimeIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Add 30 seconds to the rest"
    static let isDiscoverable = false

    func perform() async throws -> some IntentResult {
        #if !LIFT_EXTENSION
            await WorkoutActivityButtons.extendRest()
        #endif
        return .result()
    }
}

/// Skip: ends the rest here and on the Workout screen; the workout stays on the Lock Screen.
nonisolated struct SkipRestIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Skip the rest"
    static let isDiscoverable = false

    func perform() async throws -> some IntentResult {
        #if !LIFT_EXTENSION
            await WorkoutActivityButtons.skipRest()
        #endif
        return .result()
    }
}
