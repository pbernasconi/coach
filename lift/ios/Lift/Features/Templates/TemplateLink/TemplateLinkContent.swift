import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Dumb view: the link's templates with their exercises, a Replace switch on each name that already exists, and the
/// pinned "Add N templates" (SCR-2). The ✕ cancels at once: nothing is written before Add.
struct TemplateLinkContent: View {
    let state: TemplateLinkState
    let send: (TemplateLinkAction) -> Void

    var body: some View {
        NavigationStack {
            switch state.phase {
            case .loading:
                LoadingState()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .screenCanvas()
            case .failed(let problem):
                let copy = TemplateLinkText.problem(problem)
                ErrorState(verbatim: copy.title, message: copy.message, retryLabel: "Close") { send(.cancelTapped) }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .screenCanvas()
            case .review(let review):
                TemplateLinkReviewStep(review: review, submit: state.submit, send: send)
            }
        }
        .interactiveDismissDisabled(state.submit.phase == .loading)
    }
}

/// The review: a summary, one section per template, and the names that become new exercises.
private struct TemplateLinkReviewStep: View {
    let review: TemplateLinkReview
    let submit: LoadableStepState
    let send: (TemplateLinkAction) -> Void

    var body: some View {
        ReviewScaffold(
            "Add templates",
            subtitle: "Same-named templates are skipped unless you replace them.",
            flowTitle: "Template link",
            summary: ReviewSummary(
                verbatim: TemplateLinkText.templates(review.templates.count),
                caption: caption,
                symbol: "list.bullet.rectangle"
            ),
            submit: ReviewSubmit(
                verbatim: TemplateLinkText.add(review.addCount),
                isEnabled: review.addCount > 0,
                state: submit,
                disabledHint: String(localized: "Replace at least one template"),
                footnote: String(localized: "Templates sync like ones you make. Undo is offered after adding.")
            ) { send(.addTapped) },
            exit: FlowExitAction("Cancel") { send(.cancelTapped) }
        ) {
            ForEach(review.templates) { template in
                TemplateLinkTemplateSection(template: template, send: send)
            }
            if !review.newExercises.isEmpty {
                ReviewSection("New exercises") {
                    ForEach(review.newExercises) { exercise in
                        ReviewRow(verbatim: exercise.name, value: String(localized: "New exercise"))
                    }
                }
            }
        }
    }

    private var caption: String {
        let skipped = review.templates.count - review.addCount
        guard skipped > 0 else { return String(localized: "Ready to add") }
        return String(localized: "\(TemplateLinkText.templates(skipped)) skipped")
    }
}

/// One template: its exercises, and the Replace switch when the name is taken.
private struct TemplateLinkTemplateSection: View {
    let template: TemplateLinkReviewTemplate
    let send: (TemplateLinkAction) -> Void

    var body: some View {
        ReviewSection(verbatim: template.name) {
            if template.exists {
                ToggleRow(
                    "Replace the existing one",
                    subtitle: template.replaces
                        ? "Yours is removed; Undo brings it back." : "Off: this one is skipped.",
                    isOn: .action(template.replaces) { _ in send(.replaceToggled(template.id)) }
                )
            }
            ForEach(template.exercises) { exercise in
                ReviewRow(verbatim: exercise.name, value: exercise.value)
            }
            ReviewRow("Total", value: template.detail)
        }
    }
}
