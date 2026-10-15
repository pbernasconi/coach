import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Live demos for the Flows section's review and outcome screens.
struct FlowsReviewDemo: View {
    let component: CatalogComponent
    @State private var submit = LoadableStepState()
    @State private var outcome = OutcomePhase.success

    var body: some View {
        switch component {
        case .reviewScaffold: reviewScaffold
        case .reviewSection:
            ReviewSection("Project", onEdit: {}) {
                ReviewRow("Name", value: "Kitchen refresh", onEdit: {})
                ReviewRow(verbatim: "Tasks", value: "8")
            }
        case .reviewRow:
            VStack(spacing: 0) {
                ReviewRow("Due date", value: "Fri 18 Oct", onEdit: {})
                ReviewRow(verbatim: "Reminder", value: "1 hour before")
            }
        case .reviewDisclosure:
            ReviewDisclosure("Show the imported text", subtitle: "3 lines") {
                Text(verbatim: "Buy paint samples\nTape the edges\nClear the shelf")
            }
        case .outcomeScaffold:
            VStack(spacing: Space.md) {
                Picker("Phase", selection: $outcome) {
                    Text("Success").tag(OutcomePhase.success)
                    Text("Failure").tag(OutcomePhase.failure)
                    Text("Pending").tag(OutcomePhase.pending)
                }
                .pickerStyle(.segmented)
                NavigationStack {
                    OutcomeScaffold(
                        phase: outcome,
                        title: "List imported",
                        detail: "Your tasks are in the Inbox.",
                        facts: [
                            OutcomeFact(verbatim: "Tasks", value: "12"), OutcomeFact(verbatim: "Lists", value: "2"),
                        ],
                        primary: OutcomeAction("Done") {}
                    )
                }
                .frame(height: Size.minTouch * 9)
            }
        default: EmptyView()
        }
    }

    private var reviewScaffold: some View {
        NavigationStack {
            ReviewScaffold(
                "Check the import",
                flowTitle: "Import tasks",
                summary: ReviewSummary(verbatim: "12 tasks", caption: "Ready to import", onEdit: {}),
                submit: ReviewSubmit("Import tasks", state: submit) { submit.send(.submit) },
                exit: FlowExitAction(hasUnsavedProgress: true) {}
            ) {
                ReviewSection(verbatim: "Kitchen refresh") {
                    ReviewRow(verbatim: "Buy paint samples", value: "Due Fri")
                    ReviewRow(verbatim: "Tape the edges", value: "No date")
                }
                Button("Reset") { submit.send(.reset) }
            }
        }
        .frame(height: Size.minTouch * 9)
    }
}
