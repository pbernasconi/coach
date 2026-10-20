import KoboComponents
import KoboTokens
import SwiftUI

/// What was written for the whole session, under the Workout header: its warm-up, then its note (typed here or from an
/// imported Apple Note). Tapping the note edits it; without one, "Add note" opens the editor.
struct WorkoutSessionNotes: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .footnote) private var iconWidth = Size.iconSm
    let note: String?
    let warmUpNote: String?
    let onEdit: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            if let warmUpNote {
                line(String(localized: "Warm-up: \(warmUpNote)"), symbol: "flame")
            }
            if let note {
                Button(action: onEdit) {
                    line(note, symbol: "quote.bubble")
                        .frame(maxWidth: .infinity, minHeight: Size.minTouch, alignment: .leading)
                        .contentShape(.rect)
                }
                .buttonStyle(.pressFeedback)
                .accessibilityLabel(Text("Workout note: \(note)"))
                .accessibilityHint(Text("Edits the note"))
            } else {
                Button("Add note", systemImage: "square.and.pencil", action: onEdit)
                    .buttonStyle(.kobo(.plain, size: .compact, width: .inline))
                    .accessibilityLabel(Text("Add workout note"))
            }
        }
        .font(theme.font(.footnote))
        .foregroundStyle(theme.palette.textSecondary)
    }

    private func line(_ text: String, symbol: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.xs) {
            Image(systemName: symbol)
                .symbolVariant(.fill)
                .imageScale(.small)
                .frame(width: iconWidth)
                .accessibilityHidden(true)
            Text(verbatim: text)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// A set's RPE and note under its row in the set grid ("RPE 8 · paused"), lined up with the Previous column.
struct SetNoteLine: View {
    @Environment(\.koboTheme) private var theme
    let text: String
    /// The badge column's width plus its gap, so the line starts where Previous does; 0 when the row is stacked.
    let indent: CGFloat

    var body: some View {
        Text(verbatim: text)
            .font(theme.font(.footnote).monospacedDigit())
            .foregroundStyle(theme.palette.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, indent)
    }
}

/// The note editor sheet's field: a text area that grows with the note. Done (in the sheet footer) saves.
struct NoteEditorField: View {
    let editor: NoteEditor
    let send: (WorkoutAction) -> Void

    var body: some View {
        KoboTextArea(
            "Note",
            text: .action(editor.text) { send(.noteTextChanged($0)) },
            prompt: "How it went, what to change",
            lines: 3...10
        )
    }
}
