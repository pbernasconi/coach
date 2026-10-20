import AppIntents
import Foundation

// The workout Live Activity's buttons. Each is a `LiveActivityIntent`: the system runs it in Lift's process in the
// background, launching Lift when it is not running, without opening the app or unlocking the phone. Compiled into the
// app and LiftWidgets (whose buttons name them); in the extension (`LIFT_EXTENSION`) they do nothing, because the
// system never runs them there. In the app they reach the composition root's `WorkoutActivityCenter`, registered with
// `AppDependencyManager` in `LiftApp.init`, and write through the same repository as the Workout screen (PLAT-2).

/// Done: logs the set shown and starts its exercise's rest, like a tick in the app.
nonisolated struct LogSetIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Log the set"
    static let isDiscoverable = false

    @Parameter(title: "Workout")
    var sessionID: String
    @Parameter(title: "Set")
    var setID: String

    #if !LIFT_EXTENSION
        @Dependency private var center: WorkoutActivityCenter
    #endif

    init() {}

    init(sessionID: UUID, setID: UUID) {
        self.sessionID = sessionID.uuidString
        self.setID = setID.uuidString
    }

    func perform() async throws -> some IntentResult {
        #if !LIFT_EXTENSION
            if let session = UUID(uuidString: sessionID), let set = UUID(uuidString: setID) {
                await center.logSet(set, in: session)
            }
        #endif
        return .result()
    }
}

/// Next: shows the following planned set without logging the one shown.
nonisolated struct ShowNextSetIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Show the next set"
    static let isDiscoverable = false

    @Parameter(title: "Workout")
    var sessionID: String
    @Parameter(title: "Set")
    var setID: String

    #if !LIFT_EXTENSION
        @Dependency private var center: WorkoutActivityCenter
    #endif

    init() {}

    init(sessionID: UUID, setID: UUID) {
        self.sessionID = sessionID.uuidString
        self.setID = setID.uuidString
    }

    func perform() async throws -> some IntentResult {
        #if !LIFT_EXTENSION
            if let session = UUID(uuidString: sessionID), let set = UUID(uuidString: setID) {
                await center.showNextSet(after: set, in: session)
            }
        #endif
        return .result()
    }
}

/// +30s on the rest; the Workout screen's rest bar follows it.
nonisolated struct AddRestTimeIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Add 30 seconds to the rest"
    static let isDiscoverable = false

    #if !LIFT_EXTENSION
        @Dependency private var center: WorkoutActivityCenter
    #endif

    func perform() async throws -> some IntentResult {
        #if !LIFT_EXTENSION
            await center.extendRest()
        #endif
        return .result()
    }
}

/// Skip: ends the rest here and on the Workout screen; the workout stays on the Lock Screen.
nonisolated struct SkipRestIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Skip the rest"
    static let isDiscoverable = false

    #if !LIFT_EXTENSION
        @Dependency private var center: WorkoutActivityCenter
    #endif

    func perform() async throws -> some IntentResult {
        #if !LIFT_EXTENSION
            await center.skipRest()
        #endif
        return .result()
    }
}
