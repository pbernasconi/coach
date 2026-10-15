import KoboComponents
import KoboPatterns
import KoboTokens
import LiftCore
import SwiftUI

/// The review step: the parsed workouts by day with a checkbox each, the names that become new exercises, and
/// the lines that were not imported.
struct ImportReviewStep: View {
    let review: ImportReview
    let send: (ImportNotesAction) -> Void

    var body: some View {
        ReviewScaffold(
            "Check the import",
            subtitle: "Untick a workout to leave it out.",
            flowTitle: "Import from Notes",
            summary: summary,
            submit: ReviewSubmit(
                verbatim: submitTitle,
                isEnabled: !review.included.isEmpty,
                disabledHint: String(localized: "Tick at least one workout"),
                footnote: String(localized: "Workouts go to History and sync like anything you log."),
                banner: banner,
                action: { send(.importTapped) }
            ),
            exit: FlowExitAction(hasUnsavedProgress: true) { send(.exitTapped) },
            onBack: { send(.backTapped) }
        ) {
            ForEach(review.days) { day in
                ImportReviewDaySection(day: day, send: send)
            }
            if !review.newExercises.isEmpty {
                ImportNewExercisesSection(exercises: review.newExercises)
            }
            if !review.issues.isEmpty {
                ReviewDisclosure(verbatim: ImportText.linesNotImported(review.issues.count)) {
                    InlineNotice(tone: .warning, verbatimLines: review.issues.map(ImportText.issue))
                }
            }
        }
    }

    private var submitTitle: String {
        String(localized: "Import \(ImportText.workouts(review.included.count))")
    }

    private var summary: ReviewSummary {
        var caption = [ImportText.sets(review.includedSetCount)]
        if !review.newExercises.isEmpty { caption.append(ImportText.newExercises(review.newExercises.count)) }
        return ReviewSummary(
            verbatim: ImportText.workouts(review.included.count),
            caption: caption.joined(separator: " · "),
            symbol: "square.and.arrow.down"
        )
    }

    private var banner: FlowStepBanner? {
        guard !review.issues.isEmpty else { return nil }
        return FlowStepBanner(tone: .warning, verbatim: ImportText.linesNotImported(review.issues.count))
    }
}

/// One day's workouts, each a checkbox row.
private struct ImportReviewDaySection: View {
    let day: ImportReviewDay
    let send: (ImportNotesAction) -> Void

    var body: some View {
        ReviewSection(verbatim: day.title) {
            ForEach(day.sessions) { candidate in
                CheckRow(
                    verbatim: candidate.session.title,
                    subtitle: ImportText.candidateDetail(candidate),
                    isOn: .action(candidate.isIncluded) { _ in send(.sessionToggled(candidate.id)) }
                )
            }
        }
    }
}

/// Names that match no library exercise; importing creates them.
private struct ImportNewExercisesSection: View {
    let exercises: [ImportNewExercise]

    var body: some View {
        ReviewSection("New exercises") {
            ForEach(exercises) { exercise in
                ReviewRow(verbatim: exercise.name, value: String(localized: "New exercise"))
            }
        }
    }
}
