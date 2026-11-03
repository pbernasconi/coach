import KoboComponents
import KoboTokens
import SwiftUI

/// The Last week tab: what got done (time, lifts, hard sessions, a day strip), what Coach reads from the data, how
/// Paolo feels, and anything Coach should know. Next goes to Shape (SCR-2).
struct PlannerLastWeekTab: View {
    @Environment(\.koboTheme) private var theme
    let week: PlannerWeek
    let answers: PlannerAnswers
    let send: (WeekPlannerAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            if let last = week.lastWeek {
                HStack(spacing: Space.sm) {
                    StatTile(verbatim: String(localized: "Time"), value: last.timeText, unit: last.timeNote)
                    StatTile(verbatim: String(localized: "Lifts"), value: last.liftsText, delta: short(last.liftsShort))
                    StatTile(verbatim: String(localized: "Hard"), value: last.hardText, delta: short(last.hardShort))
                }
                PlannerDayStrip(days: last.days)
            }
            if !week.facts.isEmpty {
                KeyValueList(
                    "What Coach sees",
                    items: week.facts.map { KeyValueItem(verbatim: $0.label, value: $0.value, id: $0.id) }
                )
            }
            feel
            KoboTextArea(
                "Anything Coach should know?",
                text: .action(answers.lock) { send(.anythingChanged($0)) },
                prompt: "Travelling Thu–Fri, gym closed Sunday",
                lines: 2...5,
                characterLimit: 500
            )
            Button("Next: shape the week", systemImage: "arrow.right") { send(.nextTapped) }
                .buttonStyle(.kobo(.primary, width: .full))
        }
    }

    private func short(_ isShort: Bool) -> StatDelta? {
        isShort ? StatDelta("short", tone: .warning) : nil
    }

    private var feel: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            SectionHeader("How do you feel?")
            FlowLayout {
                ForEach(week.feels) { choice in
                    Chip(verbatim: choice.label, isSelected: answers.feel == choice.id) {
                        send(.feelTapped(choice.id))
                    }
                }
            }
            if let text = week.suggested.feelText {
                Text(verbatim: text)
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

/// Last week as seven squares, one per day, toned by its worst session: done green, partly yellow, missed red.
struct PlannerDayStrip: View {
    @Environment(\.koboTheme) private var theme
    let days: [PlannerWeek.LastWeek.Day]

    var body: some View {
        HStack(spacing: Space.xs) {
            ForEach(days) { day in
                VStack(spacing: Space.xxs) {
                    RoundedRectangle(cornerRadius: Radius.xs, style: .continuous)
                        .fill(fill(day.tone))
                        .frame(height: Space.xxl)
                    Text(verbatim: day.letter)
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.palette.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(Text(verbatim: day.title ?? String(localized: "Rest")))
            }
        }
    }

    private func fill(_ tone: String) -> Color {
        switch tone {
        case "good": theme.palette.success.soft
        case "warn": theme.palette.warning.soft
        case "bad": theme.palette.danger.soft
        case "neutral": theme.palette.separator
        default: theme.palette.surfaceSunken
        }
    }
}
