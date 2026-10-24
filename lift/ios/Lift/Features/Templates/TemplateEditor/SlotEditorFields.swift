import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// The slot editor sheet's fields: sets, the rep range, the load and the rest, each a stepper named by the line under
/// its number, then Move up, Move down and Remove. Done (in the sheet footer) saves.
struct SlotEditorFields: View {
    let editor: SlotEditor
    let send: (TemplateEditorAction) -> Void

    var body: some View {
        VStack(spacing: Space.lg) {
            StepperField(
                verbatim: String(localized: "Sets"),
                value: .action(editor.values.sets) { send(.editorSetsChanged($0)) },
                in: SlotEditor.setRange,
                unit: String(localized: "sets")
            )
            StepperField(
                verbatim: String(localized: "Fewest reps"),
                value: .action(editor.values.repMin) { send(.editorRepMinChanged($0)) },
                in: SlotEditor.repRange,
                unit: String(localized: "fewest reps")
            )
            StepperField(
                verbatim: String(localized: "Most reps"),
                value: .action(editor.values.repMax) { send(.editorRepMaxChanged($0)) },
                in: SlotEditor.repRange,
                unit: String(localized: "most reps")
            )
            StepperField(
                verbatim: String(localized: "Load"),
                value: .action(editor.values.weight) { send(.editorWeightChanged($0)) },
                in: 0...500,
                step: editor.step,
                unit: editor.values.weight > 0
                    ? editor.unit.rawValue : String(localized: "\(editor.unit.rawValue), 0 uses last time")
            )
            StepperField(
                verbatim: String(localized: "Rest"),
                value: .action(editor.values.rest) { send(.editorRestChanged($0)) },
                in: SlotEditor.restRange,
                step: SlotEditor.restStep,
                unit: String(localized: "seconds rest")
            )
            SlotEditorActions(editor: editor, send: send)
        }
    }
}

/// Move up, Move down and Remove: each closes the sheet and applies at once; Remove offers Undo in a toast.
private struct SlotEditorActions: View {
    let editor: SlotEditor
    let send: (TemplateEditorAction) -> Void

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: Space.sm) { buttons }
            VStack(spacing: Space.sm) { buttons }
        }
    }

    @ViewBuilder private var buttons: some View {
        Button("Move up", systemImage: "arrow.up") { send(.moveUpTapped(editor.id)) }
            .buttonStyle(.kobo(.secondary, size: .compact, width: .full))
            .disabled(!editor.canMoveUp)
        Button("Move down", systemImage: "arrow.down") { send(.moveDownTapped(editor.id)) }
            .buttonStyle(.kobo(.secondary, size: .compact, width: .full))
            .disabled(!editor.canMoveDown)
        Button("Remove", systemImage: "trash", role: .destructive) { send(.removeTapped(editor.id)) }
            .buttonStyle(.kobo(.destructiveTonal, size: .compact, width: .full))
    }
}
