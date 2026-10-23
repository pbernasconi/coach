import KoboComponents
import KoboTokens
import SwiftUI

/// What was written for the whole session, under the Workout header: its warm-up, then its note. Tapping the note
/// edits it; "Add note" is in the workout's "…".
struct WorkoutSessionNotes: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .footnote) private var iconWidth = Size.iconSm
    let note: String?
    let warmUpNote: String?
    let onEdit: () -> Void

    var body: some View {
        if warmUpNote != nil || note != nil {
            VStack(alignment: .leading, spacing: Space.xxs) {
                if let warmUpNote {
                    NoteLine(text: String(localized: "Warm-up: \(warmUpNote)"), symbol: "flame", iconWidth: iconWidth)
                }
                if let note {
                    Button(action: onEdit) {
                        NoteLine(text: note, symbol: "quote.bubble", iconWidth: iconWidth)
                            .frame(maxWidth: .infinity, minHeight: Size.minTouch, alignment: .leading)
                            .contentShape(.rect)
                    }
                    .buttonStyle(.pressFeedback)
                    .accessibilityLabel(Text("Workout note: \(note)"))
                    .accessibilityHint(Text("Edits the note"))
                }
            }
            .font(theme.font(.footnote))
            .foregroundStyle(theme.palette.textSecondary)
        }
    }
}

/// The note of an exercise with no How to page, under its header. Tapping it edits it.
struct WorkoutExerciseNote: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .footnote) private var iconWidth = Size.iconSm
    let name: String
    let note: String
    let onEdit: () -> Void

    var body: some View {
        Button(action: onEdit) {
            NoteLine(text: note, symbol: "quote.bubble", iconWidth: iconWidth)
                .frame(maxWidth: .infinity, minHeight: Size.minTouch, alignment: .leading)
                .contentShape(.rect)
        }
        .buttonStyle(.pressFeedback)
        .font(theme.font(.footnote))
        .foregroundStyle(theme.palette.textSecondary)
        .accessibilityLabel(Text("Note on \(name): \(note)"))
        .accessibilityHint(Text("Edits the note"))
    }
}

/// One note line: a small symbol, then the text.
private struct NoteLine: View {
    let text: String
    let symbol: String
    let iconWidth: CGFloat

    var body: some View {
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
