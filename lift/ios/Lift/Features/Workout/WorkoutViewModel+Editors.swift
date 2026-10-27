import Foundation
import LiftCore
import LiftStore

/// The writes behind the editors' Done: the set editor's values, RPE and note, and the session or exercise note. Each
/// runs on its own, so a log never waits for it, and a failure shows the "could not save" toast.
extension WorkoutViewModel {
    /// Saves values through `saveValues` only and never logs the set (product rule); a changed RPE or note goes
    /// through `saveDetails`. "Apply to later sets" also saves a new weight and new reps onto the later planned sets of
    /// the same kind (`SetEditor.laterSets`).
    func saveSetEditor(_ editor: SetEditor) -> Task<Void, Never> {
        let weight = editor.weight > 0 ? Weight(editor.weight, editor.unit) : nil
        let reps = editor.reps > 0 ? editor.reps : nil
        let item = detail?.find(setID: editor.id)?.0
        let updates = item.map { editor.laterSets(in: $0, weight: weight, reps: reps) } ?? []
        let savesValues = editor.hasValueChanges || !editor.hasDetailChanges
        return write { sets in
            if savesValues {
                _ = try await sets.saveValues(setID: editor.id, reps: reps, weight: weight)
            }
            if editor.hasDetailChanges {
                _ = try await sets.saveDetails(setID: editor.id, rpe: editor.rpe, note: editor.note)
            }
            for set in updates {
                _ = try await sets.saveValues(setID: set.id, reps: set.reps, weight: set.weight)
            }
        }
    }

    /// Saves the session's or the exercise's note; nothing when the text did not change.
    func saveNote(_ editor: NoteEditor) -> Task<Void, Never>? {
        guard editor.hasChanges else { return nil }
        let sessions = edits.sessions
        return Task {
            do {
                switch editor.target {
                case .session(let id): _ = try await sessions.saveNote(sessionID: id, note: editor.text)
                case .exercise(let id): _ = try await sessions.saveExerciseNote(id: id, note: editor.text)
                }
            } catch {
                showToast(.failed)
            }
        }
    }
}
