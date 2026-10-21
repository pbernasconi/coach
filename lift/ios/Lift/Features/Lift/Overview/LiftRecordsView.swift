import KoboComponents
import KoboTokens
import SwiftUI

/// The latest records (estimated 1RM), newest first; each opens the session it was set in.
struct LiftRecordsView: View {
    let records: LiftRecords
    let send: (LiftOverviewAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            LiftCaption(text: "\(records.title) · \(records.caption)")
            if records.items.isEmpty {
                LiftCaption(text: records.emptyText)
            } else {
                ListSection {
                    ForEach(records.items) { record in
                        ListRow(
                            verbatim: record.name,
                            subtitle: record.detail,
                            value: [record.e1rmText, record.gainText].compactMap(\.self).joined(separator: " · "),
                            action: { send(.sessionTapped(record.sessionId)) }
                        )
                    }
                } header: {
                    EmptyView()
                }
            }
        }
    }
}

/// Every exercise with a logged set, folded: name, sessions and last time, and the best. Each opens its exercise.
struct LiftExerciseIndexView: View {
    let exercises: LiftExerciseIndex
    let isExpanded: Bool
    let send: (LiftOverviewAction) -> Void

    var body: some View {
        Collapsible(
            verbatim: exercises.title,
            subtitle: "\(exercises.count)",
            isExpanded: .action(isExpanded) { send(.exercisesExpandedChanged($0)) }
        ) {
            ListSection {
                ForEach(exercises.items) { item in
                    ListRow(
                        verbatim: item.name,
                        subtitle: item.detail,
                        value: item.bestText,
                        action: { send(.exerciseTapped(item.exerciseKey)) }
                    )
                }
            } header: {
                EmptyView()
            }
        }
    }
}
