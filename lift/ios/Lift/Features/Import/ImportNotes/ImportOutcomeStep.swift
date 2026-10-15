import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// How the import ended, with what was written. A stopped or failed import says plainly what was saved.
struct ImportOutcomeStep: View {
    let outcome: ImportOutcome
    let send: (ImportNotesAction) -> Void

    var body: some View {
        OutcomeScaffold(
            phase: phase,
            verbatim: ImportOutcomeCopy.title(outcome),
            detail: ImportOutcomeCopy.detail(outcome),
            facts: facts,
            primary: OutcomeAction("Done") { send(.doneTapped) }
        )
    }

    private var phase: OutcomePhase {
        switch outcome.ending {
        case .finished: .success
        case .cancelled: .unknown
        case .failed: .failure
        }
    }

    private var facts: [OutcomeFact] {
        [
            OutcomeFact(verbatim: String(localized: "Workouts"), value: "\(outcome.tally.sessions)"),
            OutcomeFact(verbatim: String(localized: "Sets"), value: "\(outcome.tally.sets)"),
            OutcomeFact(verbatim: String(localized: "New exercises"), value: "\(outcome.tally.newExercises)"),
        ]
    }
}
