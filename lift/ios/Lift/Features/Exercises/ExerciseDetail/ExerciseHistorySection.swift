import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// "Your history": the last logged sessions of this exercise with their best set and estimated one-rep max.
struct ExerciseHistorySection: View {
    let history: Loadable<[ExerciseHistoryRow]>

    var body: some View {
        switch history {
        case .loading:
            ListLoadingSkeleton(title: "Your history", rows: 3, showsLeading: false)
        case .empty:
            ListSection("Your history") {
                ListRow("No logged sets yet", subtitle: "Sessions where you log this exercise show up here.")
            }
        case .failed:
            ListSection("Your history") {
                ListRow("History could not be loaded")
            }
        case .loaded(let rows):
            ListSection("Your history", footer: "Est. 1RM uses the Epley formula on the best set.") {
                ForEach(rows) { row in
                    ListRow(verbatim: row.dayTitle, subtitle: "\(row.best) · \(row.sets)", value: row.estimate)
                }
            }
        }
    }
}
