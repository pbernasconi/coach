import Foundation
import LiftStore

extension NoteEditor {
    /// The editor that `action` opens over `detail`: the session's note, or one exercise's as stored (next-time lines
    /// included). Nil for another action or an exercise the session does not have.
    init?(opening action: WorkoutAction, in detail: SessionDetail) {
        switch action {
        case .sessionNoteTapped:
            let text = detail.session.note ?? ""
            self.init(
                target: .session(detail.id),
                title: String(localized: "Workout note"),
                text: text,
                savedText: text
            )
        case .exerciseNoteTapped(let id):
            guard let exercise = detail.items.first(where: { $0.id == id })?.exercise else { return nil }
            let text = exercise.note ?? ""
            let title = String(localized: "Note · \(exercise.displayName)")
            self.init(target: .exercise(id), title: title, text: text, savedText: text)
        default:
            return nil
        }
    }

    /// The draft after a note action, or nil once it is dismissed. Done saves, so the ViewModel handles it.
    func applying(_ action: WorkoutAction) -> NoteEditor? {
        var draft = self
        switch action {
        case .noteTextChanged(let text): draft.text = text
        case .noteDismissed: return nil
        default: break
        }
        return draft
    }
}
