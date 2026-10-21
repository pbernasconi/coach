import SwiftUI

/// The Lock Screen banner for the whole workout, at the full height a Live Activity gets: the workout and where it
/// stands, the exercise and set to do now with its dots, the weight or the rest countdown, a bar, then the buttons.
/// While resting it counts down; once the rest is over (the content is stale) it says so and counts up, with the next
/// set's load ready to log.
struct WorkoutLockScreenView: View {
    let attributes: WorkoutActivityAttributes
    let state: WorkoutActivityAttributes.ContentState
    /// The rest's end has passed (`ActivityViewContext.isStale`).
    let isStale: Bool

    private var isResting: Bool { state.isResting(isStale: isStale) }

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            WorkoutHeader(attributes: attributes, state: state)
            if let set = state.current {
                HStack(alignment: .center, spacing: 12) {
                    CurrentSetSummary(set: set, dots: state.dots, showsLoad: isResting)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    CurrentSetTrailing(set: set, rest: state.rest, isResting: isResting)
                }
                WorkoutBar(state: state, isResting: isResting)
                WorkoutButtons(set: set, isResting: isResting)
            } else {
                WorkoutCompleteRow(state: state)
                WorkoutBar(state: state, isResting: false)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }
}

/// The badge, "UPPER A" and "Exercise 2 of 5 · 7/18 sets".
struct WorkoutHeader: View {
    let attributes: WorkoutActivityAttributes
    let state: WorkoutActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 7) {
            LiftBadge(size: 18)
            Text(verbatim: attributes.title)
                .font(.caption.weight(.bold))
                .textCase(.uppercase)
                .lineLimit(1)
            Spacer(minLength: 8)
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

/// "Back squat", then the set dots and "Set 2" (with "· 100 kg × 5" while the big number is the rest).
struct CurrentSetSummary: View {
    let set: WorkoutActivitySet
    let dots: [WorkoutActivityDot]
    let showsLoad: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(verbatim: set.exerciseName)
                .font(.title3.weight(.bold))
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            HStack(spacing: 8) {
                SetDots(dots: dots)
                HStack(spacing: 4) {
                    Text(verbatim: set.title)
                    if showsLoad {
                        Text(verbatim: "·")
                        LoadText(set: set)
                    }
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
        }
    }
}

/// The big number on the right: the rest counting down, or the load to lift (with "Rest over +0:12" above it once the
/// rest has ended).
struct CurrentSetTrailing: View {
    @Environment(\.colorScheme) private var colorScheme
    let set: WorkoutActivitySet
    let rest: RestSnapshot?
    let isResting: Bool

    var body: some View {
        VStack(alignment: .trailing, spacing: 0) {
            if isResting, let rest {
                Text("Rest")
                    .font(.caption2.weight(.bold))
                    .textCase(.uppercase)
                    .foregroundStyle(.secondary)
                RestCountdown(rest: rest)
                    .font(.system(size: 34, weight: .semibold, design: .rounded))
                    .foregroundStyle(WidgetColors.accentText(for: colorScheme))
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 116, alignment: .trailing)
            } else {
                if let rest {
                    HStack(spacing: 4) {
                        Text("Rest over")
                        RestOvertime(rest: rest)
                    }
                    .font(.caption2.weight(.bold))
                    .textCase(.uppercase)
                    .foregroundStyle(WidgetColors.accentText(for: colorScheme))
                }
                LoadText(set: set)
                    .font(.system(.title2, design: .rounded).weight(.bold))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
    }
}

/// Every set is logged or skipped: what was done, and a hint to finish in the app.
struct WorkoutCompleteRow: View {
    let state: WorkoutActivityAttributes.ContentState

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("All sets done")
                    .font(.title3.weight(.bold))
                Text("\(state.loggedSets) of \(state.totalSets) sets · Finish in Lift")
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
