import SwiftUI

/// The Lock Screen banner for the whole workout. The top says where the workout stands and shows the exercise with
/// its photo and set dots; a bar runs edge to edge; the bottom bar holds what to do now: the load with a check to log
/// it, or, while resting, the time rested against the rest's length with Skip. A rest gets an orange "Resting" strip
/// and a tinted top, so it never reads as a set. Once the rest is over (the content is stale) the set to log is back,
/// with "Rest over +0:12" in the header. A paused workout says "Paused" in the header.
struct WorkoutLockScreenView: View {
    @Environment(\.colorScheme) private var colorScheme
    let attributes: WorkoutActivityAttributes
    let state: WorkoutActivityAttributes.ContentState
    /// The rest's end has passed (`ActivityViewContext.isStale`).
    let isStale: Bool

    private var isResting: Bool { state.isResting(isStale: isStale) }

    var body: some View {
        VStack(spacing: 0) {
            if isResting {
                RestBand(state: state)
            }
            top
                .padding(.horizontal, 16)
                .padding(.top, 13)
                .padding(.bottom, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(isResting ? WidgetColors.restTint : .clear)
            WorkoutBar(state: state, isResting: isResting)
            bottomBar
                .padding(.leading, 16)
                .padding(.trailing, 12)
                .padding(.vertical, 10)
                .background(WidgetColors.bottomBar(for: colorScheme))
        }
    }

    @ViewBuilder private var top: some View {
        VStack(alignment: .leading, spacing: 9) {
            if !isResting {
                WorkoutHeader(attributes: attributes, state: state, isStale: isStale)
            }
            if let set = state.current {
                HStack(spacing: 12) {
                    ExerciseStill(set: set, size: 48)
                    CurrentSetSummary(set: set, dots: state.dots, isResting: isResting)
                }
            } else {
                WorkoutCompleteRow(state: state)
            }
        }
    }

    @ViewBuilder private var bottomBar: some View {
        if isResting, let rest = state.rest {
            RestBar(rest: rest, timerSize: 40)
        } else if let set = state.current {
            LiftBar(set: set)
        } else {
            Text("Finish in Coach")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// The badge, "UPPER A", and "Exercise 2 of 5 · 7/18 sets", "Paused" while paused, or "Rest over +0:12" once the rest
/// has run out.
struct WorkoutHeader: View {
    @Environment(\.colorScheme) private var colorScheme
    let attributes: WorkoutActivityAttributes
    let state: WorkoutActivityAttributes.ContentState
    let isStale: Bool

    var body: some View {
        HStack(spacing: 7) {
            CoachBadge(size: 18)
            Text(verbatim: attributes.title)
                .font(.caption.weight(.bold))
                .textCase(.uppercase)
                .lineLimit(1)
            Spacer(minLength: 8)
            if isStale, let rest = state.rest {
                HStack(spacing: 4) {
                    Text("Rest over")
                    RestOvertime(rest: rest)
                }
                .font(.caption.weight(.bold))
                .textCase(.uppercase)
                .foregroundStyle(WidgetColors.accentText(for: colorScheme))
            } else if state.isPaused {
                Label("Paused", systemImage: "pause.fill")
                    .font(.caption.weight(.bold))
                    .textCase(.uppercase)
                    .foregroundStyle(WidgetColors.accentText(for: colorScheme))
                    .lineLimit(1)
            } else {
                Text(
                    "Exercise \(state.exerciseNumber) of \(state.exerciseCount) · \(state.loggedSets)/\(state.totalSets) sets"
                )
                .font(.caption)
                .foregroundStyle(.secondary)
                .monospacedDigit()
                .lineLimit(1)
            }
        }
    }
}

/// "Back squat", then the set dots and "Set 2", or "Next: Set 2 · 100 kg × 5" while resting.
struct CurrentSetSummary: View {
    let set: WorkoutActivitySet
    let dots: [WorkoutActivityDot]
    let isResting: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(verbatim: set.exerciseName)
                .font(.title3.weight(.bold))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            HStack(spacing: 8) {
                SetDots(dots: dots)
                Group {
                    if isResting {
                        Text("Next: \(set.title) · \(set.loadText)")
                    } else {
                        Text(verbatim: set.title)
                    }
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Every set is logged or skipped: what was done.
struct WorkoutCompleteRow: View {
    let state: WorkoutActivityAttributes.ContentState

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("All sets done")
                    .font(.title3.weight(.bold))
                Text("\(state.loggedSets) of \(state.totalSets) sets")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 34))
                .foregroundStyle(WidgetColors.accent)
                .accessibilityHidden(true)
        }
    }
}
