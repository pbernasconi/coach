#if DEBUG
    import KoboComponents
    import KoboTokens
    import SwiftUI

    /// A three-step "Import notes" flow (paste → review → done) built only from the Flows family, for previews and the
    /// catalog. The sample text is made up.
    struct FlowsImportNotesPreview: View {
        private enum Step: Hashable { case review, done }

        static let sample = "Mon 14 Oct\nCall the plumber 30m\nPay rent 5m\nWrite the report 2h"

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
                subtitle: "Copy a task list from Notes and paste it here.",
                flowTitle: "Import notes",
                primary: FlowStepAction("Continue", isEnabled: !text.isEmpty, disabledHint: "Paste some notes first") {
                    path.append(.review)
                },
                secondary: FlowStepAction("Use the sample") { text = Self.sample },
                exit: FlowExitAction(hasUnsavedProgress: !text.isEmpty) { text = "" }
            ) {
                KoboTextArea("Notes", text: $text, prompt: "Mon 14 Oct, Call the plumber 30m…")
            }
        }

        private var review: some View {
            ReviewScaffold(
                "Check the import",
                flowTitle: "Import notes",
                summary: ReviewSummary(verbatim: "3 tasks", caption: "Ready to import", note: "1 list, about 2 h 35 min"),
                submit: ReviewSubmit("Import tasks", state: importState) {
                    importState.send(.submit)
                    importState.send(.succeed)
                    path.append(.done)
                },
                exit: FlowExitAction(hasUnsavedProgress: true) { path = [] }
            ) {
                ReviewSection(verbatim: "Mon 14 Oct", onEdit: { path = [] }) {
                    ReviewRow(verbatim: "Call the plumber", value: "30 min")
                    ReviewRow(verbatim: "Pay rent", value: "5 min")
                    ReviewRow(verbatim: "Write the report", value: "2 h")
                }
                ReviewDisclosure("Show the pasted text", subtitle: "4 lines") { Text(verbatim: text) }
            }
        }

        private var done: some View {
            OutcomeScaffold(
                phase: .success,
                title: "Notes imported",
                detail: "Your tasks are in your inbox.",
                facts: [OutcomeFact(verbatim: "Lists", value: "1"), OutcomeFact(verbatim: "Tasks", value: "3")],
                primary: OutcomeAction("Done") {
                    path = []
                    text = ""
                    importState.send(.reset)
                }
            )
        }
    }

    /// The outcome after a saved trip, with share text.
    struct FlowsTripSavedPreview: View {
        let phase: OutcomePhase
        private let facts = [
            OutcomeFact(verbatim: "Duration", value: "4 days"),
            OutcomeFact(verbatim: "Stops", value: "6"),
            OutcomeFact(verbatim: "Distance", value: "320 km"),
        ]

        var body: some View {
            NavigationStack {
                OutcomeScaffold(
                    phase: phase,
                    title: phase == .pending ? "Saving your trip" : "Trip saved",
                    detail: phase == .pending ? nil : "Lisbon is in your trips. Next up: Porto on Thursday.",
                    facts: phase == .pending ? [] : facts,
                    primary: OutcomeAction("Done") {},
                    secondary: OutcomeAction("View trip") {},
                    shareText: OutcomeShareText.text(title: "Trip saved", status: "Lisbon", facts: facts)
                )
            }
        }
    }

    #Preview("Import notes flow") { FlowsImportNotesPreview() }
    #Preview("Import notes flow · dark, Amber") {
        FlowsImportNotesPreview().koboTheme(.amber).preferredColorScheme(.dark)
    }
    #Preview("Import notes flow · AX3") { FlowsImportNotesPreview().dynamicTypeSize(.accessibility3) }
    #Preview("Trip saved") { FlowsTripSavedPreview(phase: .success) }
    #Preview("Trip saving · dark") { FlowsTripSavedPreview(phase: .pending).preferredColorScheme(.dark) }
    #Preview("Trip saved · AX3, Amber") {
        FlowsTripSavedPreview(phase: .success).koboTheme(.amber).dynamicTypeSize(.accessibility3)
    }
#endif
