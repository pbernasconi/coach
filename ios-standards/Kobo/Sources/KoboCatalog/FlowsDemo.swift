import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Live demos for the Flows section: flow steps, the step indicator, primers and the update gate. Review and outcome
/// screens live in `FlowsReviewDemo`. Full-screen pieces sit in a short `NavigationStack` frame.
struct FlowsDemo: View {
    let component: CatalogComponent
    @State private var title = ""
    @State private var step = 1
    @State private var estimate = 2.0
    @State private var submit = LoadableStepState()

    var body: some View {
        switch component {
        case .flowStep:
            framed {
                FlowStep(
                    "Name your list",
                    subtitle: "You can rename it later.",
                    flowTitle: "New list",
                    primary: FlowStepAction("Continue", isEnabled: !title.isEmpty, disabledHint: "Enter a name first") {
                        submit.send(.submit)
                    },
                    submitState: submit,
                    exit: FlowExitAction(hasUnsavedProgress: !title.isEmpty) { title = "" }
                ) {
                    KoboTextField("Name", text: $title, prompt: "Groceries")
                }
            }
        case .progressFlowStep: progressStep
        case .valueStep:
            framed {
                ValueStep(
                    "Daily focus goal",
                    subtitle: "How many hours of focused work you aim for.",
                    next: FlowStepAction("Continue") {}
                ) {
                    StepperField("Hours", value: $estimate, in: 0...12, step: 0.5, unit: "h")
                }
            }
        case .stepIndicator:
            VStack(spacing: Space.xl) {
                StepIndicator(step: step, of: 3, label: "Details")
                StepIndicator(step: step, of: 3, style: .dots)
                StepIndicator(step: step, of: nil, verbatim: "Extras", style: .bar)
                Button("Next step") { step = step % 3 + 1 }.buttonStyle(.kobo(.secondary))
            }
        case .primerPage:
            framed {
                PrimerPage(
                    model: PrimerPageModel(
                        verbatim: "Turn on reminders",
                        message: "Get a nudge before a task is due, even with the app closed.",
                        symbol: "bell.badge",
                        reasons: [PrimerPageModel.Reason(symbol: "clock", verbatim: "Alerts before due times")]
                    ),
                    primary: PrimerPageAction("Allow reminders") {},
                    secondary: .notNow {}
                )
            }
        case .updateGateScreen:
            framed { UpdateGateScreen("Time to update", message: "This version can't sync your lists any more.") {} }
        default: FlowsReviewDemo(component: component)
        }
    }

    private var progressStep: some View {
        framed {
            ProgressFlowStep(
                "New project",
                step: step,
                of: 3,
                stepLabel: "Details",
                primary: FlowStepAction("Continue") { step = min(step + 1, 3) },
                onBack: { step = max(step - 1, 1) }
            ) {
                Text(verbatim: "Step \(step) of 3")
            }
        }
    }

    private func framed<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        NavigationStack { content() }
            .frame(height: Size.minTouch * 9)
    }
}
