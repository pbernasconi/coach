import KoboComponents
import KoboTokens
import SwiftUI

/// One card of a reply, chosen by its kind; each opens the screen that shows its thing in full.
struct CoachAttachmentView: View {
    let attachment: CoachAttachment
    let media: [URL: MediaImage]
    let send: (CoachAction) -> Void

    var body: some View {
        switch attachment {
        case .workout(let item):
            CoachWorkoutCard(item: item) { send(.workoutOpened(item.id)) }
        case .week(let week):
            CoachWeekCard(week: week) { send(.weekOpened) }
        case .exercise(let exercise):
            let url = exercise.item?.media?.image
            CoachExerciseCard(
                exercise: exercise,
                media: url.flatMap { media[$0] },
                onOpen: exercise.exerciseKey.map { key in { send(.exerciseOpened(key)) } }
            )
            .onAppear { if let url { send(.mediaNeeded(url)) } }
        case .readiness(let readiness):
            CoachReadinessCard(readiness: readiness) { send(.todayOpened) }
        case .day(let day):
            CoachDayCard(day: day)
        case .breakdown(let breakdown):
            CoachBreakdownView(breakdown: breakdown) { send(.breakdownOpened(breakdown.link)) }
        case .unknown:
            EmptyView()
        }
    }
}
