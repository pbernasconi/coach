import KoboComponents
import KoboTokens
import SwiftUI

/// The workout under way, in the bar above the tab bar while the Workout screen is closed (like a music app's mini
/// player): a ring of the sets done (it fills with the rest while resting), the workout's name, what is happening now,
/// and its clock. A tap anywhere opens the workout again. Display only: it shows what the Workout screen and the Lock
/// Screen show, and changes nothing.
struct ActiveWorkoutAccessory: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .subheadline) private var ringSize = Size.iconLg + Space.xs
    let bar: ActiveWorkoutBar
    let open: () -> Void

    var body: some View {
        // Once a second, so the clock and the rest move on from the stored times (never counted up by a timer).
        TimelineView(.periodic(from: .distantPast, by: 1)) { context in
            let now = context.date
            MiniPlayerBar(verbatim: bar.title, subtitle: bar.detailText(at: now), action: open) {
                ring(at: now)
            } trailing: {
                clock(at: now)
            }
            .accessibilityHint(Text("Opens the workout"))
        }
    }

    private func ring(at now: Date) -> some View {
        ProgressRing(progress: bar.ringProgress(at: now), lineWidth: Space.xs, accessibilityLabel: "Workout progress") {
            Image(systemName: bar.isPaused ? "pause.fill" : "dumbbell.fill")
                .font(theme.font(.caption).weight(.bold))
                .foregroundStyle(bar.isPaused ? theme.palette.textSecondary : theme.palette.accentText)
        }
        .frame(width: ringSize, height: ringSize)
        .accessibilityHidden(true)  // the title and the line say it
    }

    @ViewBuilder
    private func clock(at now: Date) -> some View {
        if let text = bar.clockText(at: now) {
            Button(action: open) {
                Text(verbatim: text)
                    .font(theme.font(.subheadline).weight(.semibold).monospacedDigit())
                    .foregroundStyle(bar.isPaused ? theme.palette.textSecondary : theme.palette.textPrimary)
                    .frame(minHeight: Size.minTouch)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)  // no glass inside the bar's glass
            .accessibilityLabel(Text("Workout time \(text)"))
        }
    }
}

#if DEBUG
    private struct ActiveWorkoutAccessoryPreview: View {
        let bar: ActiveWorkoutBar

        var body: some View {
            ActiveWorkoutAccessory(bar: bar, open: {})
                .padding(.vertical, Space.xs)
                .glassEffect(.regular, in: .capsule)
                .padding(Space.gutter)
        }
    }

    private func previewBar(clock: WorkoutClockPhase, rest: RestSnapshot? = nil) -> ActiveWorkoutBar {
        ActiveWorkoutBar(
            sessionID: UUID(),
            title: "Upper A",
            clock: clock,
            exerciseName: "Bench press",
            setTitle: "Set 2",
            rest: rest,
            progress: 0.4
        )
    }

    private struct ActiveWorkoutBarsPreview: View {
        var body: some View {
            VStack {
                ActiveWorkoutAccessoryPreview(bar: previewBar(clock: .running(since: .now.addingTimeInterval(-1_935))))
                ActiveWorkoutAccessoryPreview(
                    bar: previewBar(
                        clock: .running(since: .now.addingTimeInterval(-1_935)),
                        rest: RestSnapshot(endsAt: .now.addingTimeInterval(84), totalSeconds: 120)
                    )
                )
                ActiveWorkoutAccessoryPreview(bar: previewBar(clock: .paused(elapsed: 1_935)))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .screenCanvas()
        }
    }

    #Preview("Active workout bar") { ActiveWorkoutBarsPreview() }
    #Preview("Active workout bar · dark") { ActiveWorkoutBarsPreview().preferredColorScheme(.dark) }
    #Preview("Active workout bar · AX3") { ActiveWorkoutBarsPreview().dynamicTypeSize(.accessibility3) }
#endif
