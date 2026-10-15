import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Dumb view: the flow's current step inside its own navigation stack (SCR-2). The steps live in one screen, so
/// the review step draws its own back chevron and the ✕ closes the whole flow.
struct ImportNotesContent: View {
    let state: ImportNotesState
    let send: (ImportNotesAction) -> Void

    var body: some View {
        NavigationStack {
            step
        }
        .interactiveDismissDisabled(state.isImporting)
    }

    @ViewBuilder private var step: some View {
        switch state.step {
        case .paste(let phase):
            ImportPasteStep(text: state.text, phase: phase, send: send)
        case .review(let review):
            ImportReviewStep(review: review, send: send)
                .environment(\.flowStepPosition, .laterInModal)
        case .importing(let progress):
            ImportProgressStep(progress: progress, send: send)
        case .outcome(let outcome):
            ImportOutcomeStep(outcome: outcome, send: send)
        }
    }
}
