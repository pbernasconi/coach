import Foundation
import LiftCore

/// Everything the Import from Notes flow renders. The steps exclude each other, so they are one enum (SCR-6).
nonisolated struct ImportNotesState: Equatable, Sendable {
    /// The pasted note. Kept while moving back from the review step.
    var text = ""
    var step: ImportStep = .paste(.editing)

    /// True while a write is running, so the sheet cannot be swiped away half-way.
    var isImporting: Bool {
        if case .importing = step { return true }
        return false
    }
}

/// The flow's steps: paste → review → importing → outcome.
nonisolated enum ImportStep: Equatable, Sendable {
    case paste(PastePhase)
    case review(ImportReview)
    case importing(ImportProgress)
    case outcome(ImportOutcome)
}

/// The paste step's submit.
nonisolated enum PastePhase: Equatable, Sendable {
    case editing
    /// Reading the note and checking which workouts already exist.
    case reading
    case failed(ImportProblem)
}

/// Why the paste step could not move on.
nonisolated enum ImportProblem: Equatable, Sendable {
    /// Nothing but spaces was pasted.
    case emptyText
    /// Paste was tapped with no text on the clipboard.
    case clipboardEmpty
    /// The text has no workout title lines.
    case nothingParsed
}

/// How far the write has got.
nonisolated struct ImportProgress: Equatable, Sendable {
    var tally = ImportTally()
    var sessionTotal: Int
    var setTotal: Int
    /// Stop was tapped; the write ends before its next row.
    var isStopping = false

    var fraction: Double { setTotal == 0 ? 0 : Double(tally.sets) / Double(setTotal) }
}

/// What the import wrote and how it ended.
nonisolated struct ImportOutcome: Equatable, Sendable {
    var ending: ImportEnding
    var tally: ImportTally
    /// Workouts the review asked for.
    var sessionTotal: Int
}
