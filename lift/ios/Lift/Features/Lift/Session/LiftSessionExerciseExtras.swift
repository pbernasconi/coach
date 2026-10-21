import KoboComponents
import KoboTokens
import SwiftUI

/// The lower half of an exercise card: last time (to that session), the best e1RM with its trend (to the exercise's
/// page), and the catalog's steps under "How to".
struct LiftSessionExerciseExtras: View {
    @Environment(\.koboTheme) private var theme
    let exercise: LiftSessionExercise
    let isStepsExpanded: Bool
    let send: (LiftSessionAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            if let last = exercise.lastTime {
                LiftLastTimeLink(last: last) { send(.lastTimeTapped(sessionID: last.sessionId)) }
            } else if let empty = exercise.lastTimeEmptyText {
                Text(verbatim: empty)
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textTertiary)
            }
            if let best = exercise.best {
                LiftBestLink(best: best, trend: exercise.trend, name: exercise.name) {
                    send(.exerciseTapped(exerciseKey: exercise.exerciseKey))
                }
            }
            if !exercise.steps.isEmpty {
                Collapsible(
                    "How to",
                    isExpanded: .action(isStepsExpanded) {
                        send(.stepsExpandedChanged(exerciseID: exercise.id, isExpanded: $0))
                    }
                ) {
                    VStack(alignment: .leading, spacing: Space.xs) {
                        ForEach(Array(exercise.steps.enumerated()), id: \.offset) { index, step in
                            Text(verbatim: "\(index + 1). \(step)")
                                .font(theme.font(.subheadline))
                                .foregroundStyle(theme.palette.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
        }
    }
}

/// "Last time · Sep 25", the change against it and its sets; opens that session.
private struct LiftLastTimeLink: View {
    @Environment(\.koboTheme) private var theme
    let last: LiftLastTime
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .center, spacing: Space.sm) {
                VStack(alignment: .leading, spacing: Space.xxs) {
                    HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                        Text(verbatim: last.title)
                            .font(theme.font(.subheadline).weight(.semibold))
                            .foregroundStyle(theme.palette.textPrimary)
                        if let delta = last.deltaText {
                            Text(verbatim: delta)
                                .font(theme.font(.footnote).monospacedDigit())
                                .foregroundStyle(theme.palette.accentText)
                        }
                    }
                    Text(verbatim: last.sets.joined(separator: " · "))
                        .font(theme.font(.footnote).monospacedDigit())
                        .foregroundStyle(theme.palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.right")
                    .font(theme.font(.footnote).weight(.semibold))
                    .foregroundStyle(theme.palette.textTertiary)
                    .accessibilityHidden(true)
            }
            .padding(Space.md)
            .background(theme.palette.surfaceSunken, in: RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.pressFeedback)
        .accessibilityHint(Text("Opens that session"))
    }
}

/// The best e1RM and the trend of the last sessions; opens the exercise's page.
private struct LiftBestLink: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .footnote) private var sparkHeight = Size.iconLg * 1.5
    let best: LiftBest
    let trend: LiftTrend?
    let name: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .center, spacing: Space.md) {
                VStack(alignment: .leading, spacing: Space.xxs) {
                    Text("Best e1RM")
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.palette.textSecondary)
                    Text(verbatim: best.text)
                        .font(theme.font(.headline).monospacedDigit())
                        .foregroundStyle(theme.palette.textPrimary)
                    Text(verbatim: best.dateText)
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.palette.textTertiary)
                }
                if let trend {
                    VStack(alignment: .leading, spacing: Space.xxs) {
                        Sparkline(values: trend.values, verbatimAccessibilityLabel: "\(name), \(trend.caption)")
                            .frame(height: sparkHeight)
                        Text(verbatim: trend.caption)
                            .font(theme.font(.caption))
                            .foregroundStyle(theme.palette.textTertiary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    Spacer(minLength: 0)
                }
                Image(systemName: "chevron.right")
                    .font(theme.font(.footnote).weight(.semibold))
                    .foregroundStyle(theme.palette.textTertiary)
                    .accessibilityHidden(true)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.pressFeedback)
        .accessibilityHint(Text("Opens the exercise"))
    }
}
