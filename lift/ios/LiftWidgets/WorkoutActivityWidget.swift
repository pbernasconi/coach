import ActivityKit
import SwiftUI
import WidgetKit

/// The workout on the Lock Screen and in the Dynamic Island, for the whole workout. The app starts and updates it; its
/// buttons run App Intents in the background that log sets and skip the rest. The system counts the rest up to its
/// length and marks the content stale there, which turns the rest back into the set to log, with "Rest over".
struct WorkoutActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            WorkoutLockScreenView(attributes: context.attributes, state: context.state, isStale: context.isStale)
                .activitySystemActionForegroundColor(WidgetColors.accent)
        } dynamicIsland: { context in
            let isResting = context.state.isResting(isStale: context.isStale)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    IslandLeading(state: context.state, isResting: isResting)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    IslandTrailing(isResting: isResting, isPaused: context.state.isPaused)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    IslandBottom(state: context.state, isResting: isResting)
                }
            } compactLeading: {
                IslandCompactLeading(isResting: isResting)
            } compactTrailing: {
                IslandCompactTrailing(state: context.state, isResting: isResting)
            } minimal: {
                IslandMinimal(state: context.state, isResting: isResting)
            }
            .keylineTint(WidgetColors.accent)
        }
    }
}

/// The expanded island's left: the exercise photo (or the badge) beside the exercise and the set, or what comes
/// after the rest.
struct IslandLeading: View {
    let state: WorkoutActivityAttributes.ContentState
    let isResting: Bool

    var body: some View {
        HStack(spacing: 10) {
            if let set = state.current, set.still != nil {
                ExerciseStill(set: set, size: 36)
            } else {
                CoachBadge(size: 26)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(verbatim: state.current?.exerciseName ?? String(localized: "All sets done"))
                    .font(.headline)
                    .lineLimit(1)
                if let set = state.current {
                    Group {
                        if isResting {
                            Text("Next: \(set.title) · \(set.loadText)")
                        } else {
                            Text("\(set.title) · \(state.loggedSets)/\(state.totalSets) sets")
                        }
                    }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                }
            }
        }
        .padding(.leading, 4)
    }
}

/// The expanded island's right: "Resting" while resting, so the rest never reads as a set, or "Paused".
struct IslandTrailing: View {
    let isResting: Bool
    let isPaused: Bool

    var body: some View {
        if isPaused, !isResting {
            Label("Paused", systemImage: "pause.fill")
                .font(.caption.weight(.heavy))
                .textCase(.uppercase)
                .foregroundStyle(.secondary)
                .padding(.trailing, 4)
        } else if isResting {
            Label("Resting", systemImage: "timer")
                .font(.caption.weight(.heavy))
                .textCase(.uppercase)
                .foregroundStyle(WidgetColors.accent)
                .padding(.trailing, 4)
        }
    }
}

/// The expanded island's bottom: the load and its check, or the rest bar, the time rested and Skip.
struct IslandBottom: View {
    let state: WorkoutActivityAttributes.ContentState
    let isResting: Bool

    var body: some View {
        Group {
            if isResting, let rest = state.rest {
                VStack(spacing: 8) {
                    WorkoutBar(state: state, isResting: true)
                    RestBar(rest: rest, timerSize: 34)
                }
            } else if let set = state.current {
                LiftBar(set: set)
            } else {
                Text("\(state.loggedSets) of \(state.totalSets) sets · Finish in Coach")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(.horizontal, 4)
    }
}

/// The compact island's left: a timer while resting, else the barbell.
struct IslandCompactLeading: View {
    let isResting: Bool

    var body: some View {
        if isResting {
            Image(systemName: "timer")
                .foregroundStyle(WidgetColors.accent)
                .accessibilityLabel(Text("Resting"))
        } else {
            BarbellShape()
                .fill(WidgetColors.accent)
                .frame(width: 24, height: 10)
                .accessibilityLabel(Text("Workout"))
        }
    }
}

/// The compact island's right: the time rested, or the sets done so far.
struct IslandCompactTrailing: View {
    let state: WorkoutActivityAttributes.ContentState
    let isResting: Bool

    var body: some View {
        Group {
            if isResting, let rest = state.rest {
                RestElapsed(rest: rest)
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
