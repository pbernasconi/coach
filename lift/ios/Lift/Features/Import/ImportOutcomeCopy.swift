import Foundation

/// The outcome's words, kept apart from the view so they can be tested.
nonisolated enum ImportOutcomeCopy {
    static func title(_ outcome: ImportOutcome) -> String {
        switch outcome.ending {
        case .finished: String(localized: "Notes imported")
        case .cancelled: String(localized: "Import stopped")
        case .failed: String(localized: "Import did not finish")
        }
    }

    /// Says what was saved; never implies more was written than was.
    static func detail(_ outcome: ImportOutcome) -> String {
        let tally = outcome.tally
        let saved = String(
            localized:
                "\(tally.sessions) of \(outcome.sessionTotal) workouts and \(ImportText.sets(tally.sets)) were saved."
        )
        var lines: [String]
        switch outcome.ending {
        case .finished:
            lines = [String(localized: "The workouts are in History and will sync.")]
        case .cancelled, .failed:
            lines = [saved]
            if let title = tally.incompleteSession {
                lines.append(String(localized: "\(title) was saved only in part. Finish or remove it in History."))
            }
            if tally.sessions > 0 || tally.sets > 0 {
                lines.append(String(localized: "What was saved stays in History and will sync."))
            }
        }
        if case .failed = outcome.ending {
            lines.append(String(localized: "Lift could not save the rest. Try importing the remaining workouts again."))
        }
        return lines.joined(separator: " ")
    }
}
