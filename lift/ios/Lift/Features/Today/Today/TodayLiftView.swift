import KoboComponents
import KoboPatterns
import KoboTokens
import LiftSync
import SwiftUI

/// Lift on Today: arm sets against the target band, the main lifts with their e1RM lines (each opens the exercise),
/// strength days this week, and the last and next lift (each opens its session).
struct TodayLiftView: View {
    @Environment(\.koboTheme) private var theme
    let lift: TodayLift
    let send: (TodayAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            if let arms = lift.arms { TodayArmsView(arms: arms) }
            ListSection {
                if lift.mainLifts.isEmpty, let empty = lift.mainLiftsEmptyText {
                    ListRow(verbatim: empty).listRowEmphasis(.quiet)
                }
                ForEach(lift.mainLifts) { main in
                    TodayMainLiftRow(main: main) { send(.mainLiftTapped(main.exerciseKey)) }
                }
            }
            ListSection {
                if let strength = lift.strength {
                    ListRow(verbatim: String(localized: "Strength"), value: strength.text) { Sport.strength.icon }
                }
                if let last = lift.last {
                    ListRow(
                        verbatim: last.text,
                        subtitle: String(localized: "Last lift"),
                        action: { send(.liftSessionTapped(last.sessionId)) },
                        leading: { Image(systemName: "clock.arrow.circlepath").accessibilityHidden(true) },
                        trailing: {
                            StatusPill(verbatim: last.whenText, tone: last.late ? .danger : .neutral).fixedSize()
                        }
                    )
                }
                if let next = lift.next {
                    ListRow(
                        verbatim: next.title,
                        subtitle: String(localized: "Next lift"),
                        value: next.dateText,
                        action: { send(.liftSessionTapped(next.sessionId)) }
                    ) { Image(systemName: "calendar").accessibilityHidden(true) }
                } else if let empty = lift.nextEmptyText {
                    ListRow(verbatim: empty, subtitle: String(localized: "Next lift")) {
                        Image(systemName: "calendar").accessibilityHidden(true)
                    }
                    .listRowEmphasis(.quiet)
                }
            }
        }
    }
}

/// Biceps and triceps hard sets this week on the target band.
private struct TodayArmsView: View {
    @Environment(\.koboTheme) private var theme
    let arms: TodayArms

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            HStack {
                Text("Arms this week").font(theme.font(.subheadline).weight(.semibold))
                Spacer()
                Text(verbatim: arms.bandText).font(theme.font(.caption)).foregroundStyle(theme.palette.textSecondary)
            }
            ForEach(arms.rows) { row in
                HStack(spacing: Space.md) {
                    Text(verbatim: row.muscle.capitalized)
                        .font(theme.font(.subheadline))
                        .frame(minWidth: Size.thumbnail * 1.4, alignment: .leading)
                    BandBar(
                        value: row.sets,
                        scaleMax: max(arms.band.max * 1.25, row.sets),
                        band: min(arms.band.min, arms.band.max)...max(arms.band.min, arms.band.max),
                        valueText: row.setsText,
                        verbatimAccessibilityLabel: row.muscle.capitalized
                    )
                    Text(verbatim: row.setsText)
                        .font(theme.font(.subheadline).monospacedDigit())
                        .frame(minWidth: Size.iconLg, alignment: .trailing)
                }
            }
        }
        .koboCard()
    }
}

/// One main lift: name and change, the latest e1RM, and its line (or "1 session").
private struct TodayMainLiftRow: View {
    @Environment(\.koboTheme) private var theme
    let main: AppMainLift
    let action: () -> Void

    var body: some View {
        ListRow(
            verbatim: main.name,
            subtitle: [main.latestText, main.changeText].compactMap(\.self).joined(separator: " · "),
            action: action,
            leading: { EmptyView() },
            trailing: { trend.frame(width: Size.thumbnail * 1.4) }
        )
    }

    @ViewBuilder private var trend: some View {
        if main.points.count > 1 {
            Sparkline(
                values: main.points.map(\.e1rm),
                color: main.tone.map { theme.palette.status($0.kobo).ink },
                verbatimAccessibilityLabel: String(localized: "\(main.name), estimated 1RM")
            )
        } else if let spark = main.sparkText {
            Text(verbatim: spark).font(theme.font(.caption)).foregroundStyle(theme.palette.textTertiary)
        }
    }
}

/// The goals: title, status pill, progress bar, current against target, time left and the server's detail lines.
struct TodayGoalsView: View {
    @Environment(\.koboTheme) private var theme
    let goals: TodayGoals

    var body: some View {
        if goals.items.isEmpty {
            SectionEmptyCard(verbatim: goals.emptyText ?? String(localized: "No goals yet"), systemImage: "flag")
        } else {
            VStack(spacing: Space.sm) {
                ForEach(goals.items) { goal in TodayGoalCard(goal: goal) }
            }
        }
    }
}

private struct TodayGoalCard: View {
    @Environment(\.koboTheme) private var theme
    let goal: TodayGoal

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            HStack(alignment: .firstTextBaseline) {
                Text(verbatim: goal.title).font(theme.font(.headline))
                Spacer(minLength: Space.sm)
                StatusPill(verbatim: goal.statusText, tone: tone).fixedSize()
            }
            if let progress = goal.progress {
                InlineProgress(
                    value: min(max(progress, 0), 1),
                    tone: tone == .neutral ? .accent : tone,
                    accessibilityLabel: "Progress"
                )
            }
            let values = [goal.currentText, goal.targetText.map { String(localized: "target \($0)") }]
            Text(verbatim: values.compactMap(\.self).joined(separator: " · "))
                .font(theme.font(.subheadline).monospacedDigit())
            // The time left and the server's detail lines, one per line; a single Text needs no ids.
            let lines = [goal.timeText].compactMap(\.self) + goal.detail
            if !lines.isEmpty {
                Text(verbatim: lines.joined(separator: "\n"))
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textSecondary)
                    .lineSpacing(Space.xs)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .koboCard()
        .accessibilityElement(children: .combine)
    }

    /// The server's status as a pill tone: done and on track green, behind amber, missed red, the rest neutral.
    private var tone: Tone {
        switch goal.status {
        case "done", "on_track": .success
        case "behind": .warning
        case "missed": .danger
        default: .neutral
        }
    }
}
