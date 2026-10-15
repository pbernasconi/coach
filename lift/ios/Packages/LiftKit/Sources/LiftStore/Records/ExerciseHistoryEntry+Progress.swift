import Foundation
import LiftCore

extension ExerciseHistoryEntry {
    /// The entry as the progress chart reads it (`ExerciseProgress`): its day, stamped load mode and logged sets.
    public var progressSession: ProgressSession {
        ProgressSession(id: session.id, day: session.day, loadMode: loadMode, sets: sets.map(\.loggedSet))
    }
}
