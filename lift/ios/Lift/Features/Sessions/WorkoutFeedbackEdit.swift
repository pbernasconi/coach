import Foundation
import LiftSync

/// Every intent on the "How did it feel" card, the same on every workout page.
nonisolated enum WorkoutFeedbackAction: Equatable, Sendable {
    /// A face or an effort step: saves at once.
    case changed(WorkoutFeedbackChange)
    /// The note row opened its sheet.
    case commentTapped
    /// The sheet closed without saving.
    case commentClosed
    /// Save in the note sheet.
    case commentSaved(String)
    /// "Try again" after a save failed.
    case retryTapped
}

/// What a screen keeps for its card: the edited copy (nil until the first edit, then the body's own shows), the save,
/// and whether the note sheet is open. `handle` and `finish` are the whole flow, so every page saves the same way.
nonisolated struct WorkoutFeedbackEdit: Equatable, Sendable {
    var edited: WorkoutFeedback?
    var save: WorkoutFeedbackSaveState = .idle
    var isCommentOpen = false
    /// Counts saves, so an older answer never overwrites a newer edit.
    private(set) var attempt = 0

    /// A save to run: the feedback and its attempt number.
    nonisolated struct Pending: Equatable, Sendable {
        let feedback: WorkoutFeedback
        let attempt: Int
    }

    /// The card's feedback: the edited copy, else the body's.
    func shown(_ loaded: WorkoutFeedback?) -> WorkoutFeedback? {
        edited ?? loaded
    }

    /// Applies one card action. Returns the save to run, or nil (the sheet opened or closed, or nothing to save).
    mutating func handle(_ action: WorkoutFeedbackAction, loaded: WorkoutFeedback?) -> Pending? {
        guard let current = shown(loaded) else { return nil }
        switch action {
        case .commentTapped:
            isCommentOpen = true
            return nil
        case .commentClosed:
            isCommentOpen = false
            return nil
        case .changed(let change):
            return begin(current.applying(change))
        case .commentSaved(let text):
            isCommentOpen = false
            return begin(current.applying(.comment(text)))
        case .retryTapped:
            return begin(current)
        }
    }

    /// The answer of save `attempt`: the saved copy (the server may name another row), or nil when it failed. An
    /// answer to an older save is ignored.
    mutating func finish(_ saved: WorkoutFeedback?, attempt done: Int) {
        guard done == attempt else { return }
        if let saved {
            edited = saved
            save = .saved
        } else {
            save = .failed
        }
    }

    private mutating func begin(_ next: WorkoutFeedback) -> Pending {
        attempt += 1
        edited = next
        save = .saving
        return Pending(feedback: next, attempt: attempt)
    }
}

/// Saves feedback through the App API. The answer names the row the server saved under (`item`), which can differ.
@MainActor
struct WorkoutFeedbackSaver {
    let data: any AppDataSource

    /// The saved feedback, or nil when it was not saved.
    func save(_ feedback: WorkoutFeedback) async -> WorkoutFeedback? {
        do {
            let answer = try await data.put(WorkoutFeedback.path, body: try feedback.saveBody())
            var saved = feedback
            if let item = try? JSONDecoder().decode(SavedItem.self, from: answer).item { saved.item = item }
            return saved
        } catch {
            AppLog.sync.error("Feedback not saved: \(String(describing: error), privacy: .public)")
            return nil
        }
    }

    private struct SavedItem: Decodable { let item: String }
}
