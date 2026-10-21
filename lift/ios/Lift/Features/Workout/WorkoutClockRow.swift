import KoboComponents
import KoboTokens
import SwiftUI

/// Under the Workout header's progress: Start workout before the session started, then the running clock with the start
/// time. A finished session draws nothing here (its day line says how long it took). The clock reads the time from the
/// timeline each second and works out the elapsed time from the stored start, so it never drifts.
struct WorkoutClockRow: View {
    let workout: WorkoutOverview
    let send: (WorkoutAction) -> Void

    var body: some View {
        switch workout.clockPhase {
        case .notStarted:
            Button("Start workout", systemImage: "play.fill") { send(.startTapped) }
                .buttonStyle(.kobo(.primary, width: .full))
                .padding(.top, Space.xs)
        case .running(let start):
            TimelineView(.periodic(from: start, by: 1)) { context in
                WorkoutClockLine(
                    seconds: WorkoutClock.seconds(from: start, to: context.date),
                    started: workout.started
                )
            }
        case .finished, .pastDay:
            EmptyView()
        }
    }
}

/// "⏱ 12:34 · Started 9:05", or only "Started 9:05" once the start is older than `WorkoutClock.limit`.
private struct WorkoutClockLine: View {
    @Environment(\.koboTheme) private var theme
    let seconds: Int
    let started: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
            if seconds < WorkoutClock.limit {
                Label {
                    Text(verbatim: WorkoutClock.text(seconds: seconds))
                        .contentTransition(.numericText())
                } icon: {
                    Image(systemName: "timer").accessibilityHidden(true)
                }
                .font(theme.font(.title2).monospacedDigit())
                .foregroundStyle(theme.palette.accentText)
                .accessibilityLabel(Text("Workout time"))
                .accessibilityValue(Text(verbatim: WorkoutClock.spoken(seconds: seconds)))
            }
            if let started {
                Text(verbatim: started)
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textSecondary)
            }
        }
    }
}
