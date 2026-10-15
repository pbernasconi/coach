import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// The first step: the note in a text area, Paste, and a short example of the shape the importer reads.
struct ImportPasteStep: View {
    let text: String
    let phase: PastePhase
    let send: (ImportNotesAction) -> Void

    var body: some View {
        FlowStep(
            "Paste your workout notes",
            subtitle: "Copy one or more workouts from Notes, then paste them here. Nothing is saved until you import.",
            flowTitle: "Import from Notes",
            primary: FlowStepAction(
                "Review import",
                isEnabled: !text.isEmpty,
                disabledHint: "Paste a note first",
                action: { send(.continueTapped) }
            ),
            secondary: FlowStepAction("Paste", action: { send(.pasteTapped) }),
            submitState: submitState,
            exit: FlowExitAction(hasUnsavedProgress: !text.isEmpty) { send(.exitTapped) }
        ) {
            KoboTextArea(
                "Workout notes",
                text: .action(text) { send(.textChanged($0)) },
                prompt: "Workout A - Oct 6",
                lines: 6...14
            )
            ImportFormatPrimer()
        }
    }

    private var submitState: LoadableStepState {
        switch phase {
        case .editing: LoadableStepState()
        case .reading: LoadableStepState(.loading)
        case .failed(let problem): LoadableStepState(.failed(message: ImportText.problem(problem)))
        }
    }
}

/// What a note should look like, with a made-up example.
private struct ImportFormatPrimer: View {
    @Environment(\.koboTheme) private var theme

    var body: some View {
        KoboCard("What notes look like") {
            VStack(alignment: .leading, spacing: Space.md) {
                Text(
                    "Start each workout with a title line that has a date. Put each exercise on its own line, then one line per set: reps, then the weight. Ticked sets are imported as logged."
                )
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
                Text(verbatim: ImportSample.format)
                    .font(theme.font(.footnote).monospaced())
                    .foregroundStyle(theme.palette.textPrimary)
                    .accessibilityLabel(Text("Example note"))
                    .accessibilityValue(Text(verbatim: ImportSample.format))
            }
        }
    }
}
