import ActivityKit
import SwiftUI
import WidgetKit

/// The workout on the Lock Screen and in the Dynamic Island, for the whole workout. The app starts and updates it; its
/// buttons run App Intents in the background that log sets and change the rest. The system counts the rest down to its
/// end and marks the content stale there, which turns the countdown into "Rest over".
struct WorkoutActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            WorkoutLockScreenView(attributes: context.attributes, state: context.state, isStale: context.isStale)
                .activitySystemActionForegroundColor(WidgetColors.accent)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    IslandLeading(state: context.state)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    IslandTrailing(state: context.state, isResting: context.state.isResting(isStale: context.isStale))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    IslandBottom(
                        state: context.state,
                        isResting: context.state.isResting(isStale: context.isStale)
                    )
                }
            } compactLeading: {
                BarbellShape()
                    .fill(WidgetColors.accent)
                    .frame(width: 24, height: 10)
                    .accessibilityLabel(Text("Workout"))
            } compactTrailing: {
                IslandCompactTrailing(
                    state: context.state,
                    isResting: context.state.isResting(isStale: context.isStale)
                )
            } minimal: {
                IslandMinimal(state: context.state, isResting: context.state.isResting(isStale: context.isStale))
            }
            .keylineTint(WidgetColors.accent)
        }
    }
}

/// The expanded island's left: the badge over the exercise and set.
struct IslandLeading: View {
    let state: WorkoutActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 8) {
            CoachBadge(size: 26)
            VStack(alignment: .leading, spacing: 1) {
                Text(verbatim: state.current?.exerciseName ?? String(localized: "All sets done"))
                    .font(.headline)
                    .lineLimit(1)
                if let set = state.current {
                    Text(verbatim: set.title)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
        .padding(.leading, 4)
    }
}

/// The expanded island's right: the rest counting down, or the load to lift.
struct IslandTrailing: View {
    let state: WorkoutActivityAttributes.ContentState
    let isResting: Bool

    var body: some View {
        Group {
            if isResting, let rest = state.rest {
                RestCountdown(rest: rest)
                    .font(.system(.title, design: .rounded).weight(.semibold))
            } else if let set = state.current {
                LoadText(set: set)
                    .font(.system(.title3, design: .rounded).weight(.bold))
            } else {
                Image(systemName: "checkmark.circle.fill")
                    .font(.title)
                    .accessibilityLabel(Text("All sets done"))
            }
        }
        .foregroundStyle(WidgetColors.accent)
        .multilineTextAlignment(.trailing)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .padding(.trailing, 4)
    }
}

/// The expanded island's bottom: the dots and the count, the bar, then the buttons.
struct IslandBottom: View {
    let state: WorkoutActivityAttributes.ContentState
    let isResting: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                SetDots(dots: state.dots, size: 6)
                IslandUpNext(state: state, isResting: isResting)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text("\(state.loggedSets)/\(state.totalSets) sets")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
            WorkoutBar(state: state, isResting: isResting)
            if let set = state.current {
                WorkoutButtons(set: set, isResting: isResting)
            }
        }
        .padding(.horizontal, 4)
    }
}

/// Beside the dots: the load waiting while resting ("Next 100 kg × 5"), otherwise the exercise after this one.
struct IslandUpNext: View {
    let state: WorkoutActivityAttributes.ContentState
    let isResting: Bool

    var body: some View {
        Group {
            if isResting, let set = state.current {
                HStack(spacing: 4) {
                    Text("Next")
                    LoadText(set: set)
                }
            } else if let next = state.nextExercise {
                Text("Then \(next)")
            }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(1)
    }
}

/// The compact island's right: the rest, or the sets done so far.
struct IslandCompactTrailing: View {
    let state: WorkoutActivityAttributes.ContentState
    let isResting: Bool

    var body: some View {
        Group {
            if isResting, let rest = state.rest {
                RestCountdown(rest: rest)
                    .frame(maxWidth: 44)
            } else {
                Text(verbatim: "\(state.loggedSets)/\(state.totalSets)")
                    .monospacedDigit()
                    .accessibilityLabel(Text("\(state.loggedSets) of \(state.totalSets) sets done"))
            }
        }
        .foregroundStyle(WidgetColors.accent)
        .multilineTextAlignment(.trailing)
    }
}

/// The minimal island: a ring filling up through the rest, or the barbell.
struct IslandMinimal: View {
    let state: WorkoutActivityAttributes.ContentState
    let isResting: Bool

    var body: some View {
        if isResting, let rest = state.rest {
            ProgressView(timerInterval: rest.interval, countsDown: false) {
                EmptyView()
            } currentValueLabel: {
                EmptyView()
            }
            .progressViewStyle(.circular)
            .tint(WidgetColors.accent)
            .accessibilityLabel(Text("Rest"))
        } else {
            BarbellShape()
                .fill(WidgetColors.accent)
                .frame(width: 20, height: 9)
                .accessibilityLabel(Text("Workout"))
        }
    }
}
