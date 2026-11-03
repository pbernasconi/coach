import KoboComponents
import KoboTokens
import SwiftUI

/// Step 1: how last week went (time, lifts, hard sessions), day by day from Strava and the plan, Coach's read of it,
/// and how Paolo is coming into this week (SCR-2).
struct PlannerLastWeekStep: View {
    @Environment(\.koboTheme) private var theme
    let week: PlannerWeek
    let answers: PlannerAnswers
    let send: (WeekPlannerAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            if let last = week.lastWeek {
                SectionHeader(verbatim: last.titleText)
                HStack(spacing: Space.sm) {
                    StatTile(verbatim: String(localized: "Time"), value: last.timeText, unit: last.timeNote)
                    StatTile(verbatim: String(localized: "Lifts"), value: last.liftsText, delta: short(last.liftsShort))
                    StatTile(verbatim: String(localized: "Hard"), value: last.hardText, delta: short(last.hardShort))
                }
                PlannerDayStrip(days: last.days)
                if !last.read.isEmpty { PlannerReadCard(read: last.read) }
                PlannerLastWeekDays(days: last.days)
            }
            feel
            if !week.facts.isEmpty {
                KeyValueList(
                    "Going in",
                    items: week.facts.map { KeyValueItem(verbatim: $0.label, value: $0.value, id: $0.id) }
                )
            }
        }
    }

    private func short(_ isShort: Bool) -> StatDelta? {
        isShort ? StatDelta("short", tone: .warning) : nil
    }

    private var feel: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            SectionHeader("How are you coming into this week?")
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

/// Coach's read of last week: the gym, the hard sessions and the volume, each with a dot for its tone.
struct PlannerReadCard: View {
    @Environment(\.koboTheme) private var theme
    let read: [PlannerWeek.LastWeek.Read]

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            Text("Coach's read")
                .font(theme.font(.caption).weight(.semibold))
                .textCase(.uppercase)
                .foregroundStyle(theme.palette.accentText)
            ForEach(Array(read.enumerated()), id: \.offset) { _, line in
                VStack(alignment: .leading, spacing: Space.xxs) {
                    Label {
                        Text(verbatim: line.title).font(theme.font(.callout).weight(.semibold))
                    } icon: {
                        Circle()
                            .fill(line.tone == "good" ? theme.palette.success.ink : theme.palette.warning.ink)
                            .frame(width: Space.sm, height: Space.sm)
                    }
                    .foregroundStyle(theme.palette.textPrimary)
                    Text(verbatim: line.text)
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .accessibilityElement(children: .combine)
            }
        }
        .koboCard()
    }
}

/// Last week day by day: what Strava recorded, and what was missed.
struct PlannerLastWeekDays: View {
    @Environment(\.koboTheme) private var theme
    let days: [PlannerWeek.LastWeek.Day]

    var body: some View {
        KeyValueList(
            "Day by day",
            items: days.map { day in
                KeyValueItem(
                    verbatim: day.labelText,
                    value: [day.doneText, day.missedText].compactMap(\.self).joined(separator: "\n").nilIfEmpty
                        ?? String(localized: "Nothing logged"),
                    valueTone: day.missedText != nil && day.doneText == nil ? .danger : nil,
                    id: day.date
                )
            }
        )
    }
}

extension String {
    fileprivate var nilIfEmpty: String? { isEmpty ? nil : self }
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
