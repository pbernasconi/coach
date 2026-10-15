#if DEBUG
    import KoboComponents
    import KoboTokens
    import SwiftUI

    /// A three-step "Import notes" flow (paste → review → done) built only from the Flows family, for previews and the
    /// catalog. The sample text is made up.
    struct FlowsImportNotesPreview: View {
        private enum Step: Hashable { case review, done }

        static let sample = "Mon 14 Oct\nBench press 3x8 80kg\nBent-over row 3x10 60kg\nPlank 3x45s"

        @State private var path: [Step] = []
        @State private var text = ""
        @State private var importState = LoadableStepState()

        var body: some View {
            NavigationStack(path: $path) {
                paste
                    .navigationDestination(for: Step.self) { step in
                        switch step {
                        case .review: review.environment(\.flowStepPosition, .laterInModal)
                        case .done: done
                        }
                    }
            }
        }

        private var paste: some View {
            FlowStep(
                "Paste your notes",
                subtitle: "Copy a workout log from Notes and paste it here.",
                flowTitle: "Import notes",
                primary: FlowStepAction("Continue", isEnabled: !text.isEmpty, disabledHint: "Paste some notes first") {
                    path.append(.review)
                },
                secondary: FlowStepAction("Use the sample") { text = Self.sample },
                exit: FlowExitAction(hasUnsavedProgress: !text.isEmpty) { text = "" }
            ) {
                KoboTextArea("Notes", text: $text, prompt: "Mon 14 Oct, Bench 3x8 80kg…")
            }
        }

        private var review: some View {
            ReviewScaffold(
                "Check the import",
                flowTitle: "Import notes",
                summary: ReviewSummary(verbatim: "1 workout", caption: "Ready to import", note: "3 exercises, 9 sets"),
                submit: ReviewSubmit("Import workout", state: importState) {
                    importState.send(.submit)
                    importState.send(.succeed)
                    path.append(.done)
                },
                exit: FlowExitAction(hasUnsavedProgress: true) { path = [] }
            ) {
                ReviewSection(verbatim: "Mon 14 Oct", onEdit: { path = [] }) {
                    ReviewRow(verbatim: "Bench press", value: "3 × 8 · 80 kg")
                    ReviewRow(verbatim: "Bent-over row", value: "3 × 10 · 60 kg")
                    ReviewRow(verbatim: "Plank", value: "3 × 45 s")
                }
                ReviewDisclosure("Show the pasted text", subtitle: "4 lines") { Text(verbatim: text) }
            }
        }

        private var done: some View {
            OutcomeScaffold(
                phase: .success,
                title: "Notes imported",
                detail: "Your workout is in your history.",
                facts: [OutcomeFact(verbatim: "Workouts", value: "1"), OutcomeFact(verbatim: "Sets", value: "9")],
                primary: OutcomeAction("Done") {
                    path = []
                    text = ""
                    importState.send(.reset)
                }
            )
        }
    }

    /// The outcome after a finished workout, with share text.
    struct FlowsWorkoutFinishedPreview: View {
        let phase: OutcomePhase
        private let facts = [
            OutcomeFact(verbatim: "Duration", value: "1 h 12 min"),
            OutcomeFact(verbatim: "Sets", value: "18"),
            OutcomeFact(verbatim: "Volume", value: "6,420 kg"),
        ]

        var body: some View {
            NavigationStack {
                OutcomeScaffold(
                    phase: phase,
                    title: phase == .pending ? "Saving your workout" : "Workout finished",
                    detail: phase == .pending ? nil : "Upper A is in your history. Next up: Lower A on Thursday.",
                    facts: phase == .pending ? [] : facts,
                    primary: OutcomeAction("Done") {},
                    secondary: OutcomeAction("View workout") {},
                    shareText: OutcomeShareText.text(title: "Workout finished", status: "Upper A", facts: facts)
                )
            }
        }
    }

    #Preview("Import notes flow") { FlowsImportNotesPreview() }
    #Preview("Import notes flow · dark, Amber") {
        FlowsImportNotesPreview().koboTheme(.amber).preferredColorScheme(.dark)
    }
    #Preview("Import notes flow · AX3") { FlowsImportNotesPreview().dynamicTypeSize(.accessibility3) }
    #Preview("Workout finished") { FlowsWorkoutFinishedPreview(phase: .success) }
    #Preview("Workout saving · dark") { FlowsWorkoutFinishedPreview(phase: .pending).preferredColorScheme(.dark) }
    #Preview("Workout finished · AX3, Amber") {
        FlowsWorkoutFinishedPreview(phase: .success).koboTheme(.amber).dynamicTypeSize(.accessibility3)
    }
#endif
