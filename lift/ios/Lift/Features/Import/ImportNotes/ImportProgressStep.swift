import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// The write in progress: a bar over the sets written, the counts so far, and Stop. There is no ✕ here: Stop is
/// the one way out, and it keeps what was written.
struct ImportProgressStep: View {
    @Environment(\.koboTheme) private var theme
    let progress: ImportProgress
    let send: (ImportNotesAction) -> Void

    var body: some View {
        FlowStep(
            progress.isStopping ? "Stopping the import" : "Importing workouts",
            subtitle: "Workouts are saved on this iPhone first and sync when you are online.",
            flowTitle: "Import from Notes",
            primary: FlowStepAction(
                "Stop import",
                isEnabled: !progress.isStopping,
                action: { send(.stopTapped) }
            )
        ) {
            VStack(alignment: .leading, spacing: Space.md) {
                InlineProgress(value: progress.fraction, accessibilityLabel: "Import progress")
                Text(verbatim: counts)
                    .font(theme.font(.numeric))
                    .foregroundStyle(theme.palette.textSecondary)
            }
        }
    }

    /// "12 of 40 sets · 1 of 3 workouts".
    private var counts: String {
        let sets = String(localized: "\(progress.tally.sets) of \(progress.setTotal) sets")
        let workouts = String(localized: "\(progress.tally.sessions) of \(progress.sessionTotal) workouts")
        return "\(sets) · \(workouts)"
    }
}
