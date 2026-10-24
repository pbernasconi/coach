import Foundation

extension SetEditor {
    /// The draft after an editor action, or nil once it is dismissed. Done saves, so the ViewModel handles it.
    func applying(_ action: WorkoutAction) -> SetEditor? {
        var draft = self
        switch action {
        case .editorWeightChanged(let weight): draft.weight = max(0, weight)
        case .editorRepsChanged(let reps): draft.reps = max(0, reps)
        case .editorApplyToLaterChanged(let isOn): draft.appliesToLater = isOn
        case .editorNoteChanged(let text): draft.note = text
        case .editorDismissed: return nil
        default: break
        }
        return draft
    }
}
