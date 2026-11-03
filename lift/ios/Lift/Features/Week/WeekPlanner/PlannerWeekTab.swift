import KoboComponents
import KoboTokens
import SwiftUI

/// The Week tab: Coach's draft day by day, with the calendar it plans around in grey under each day. Above it, what
/// the last change did (with Undo); under it, Coach's reasoning, what to watch, and the box to tell Coach what to
/// change. Before a draft, a start card instead (SCR-2).
struct PlannerWeekTab: View {
    @Environment(\.koboTheme) private var theme
    let week: PlannerWeek
    let state: WeekPlannerState
    let send: (WeekPlannerAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            if week.state == .proposed {
                if let change = week.change { PlannerChangeCard(change: change, canUndo: canUndo, send: send) }
                if let checks = week.checks {
                    KoboTag(verbatim: checks.text, tone: PlannerTone.of(checks.tone), systemImage: "checkmark.seal")
                }
            } else {
                start
            }
            VStack(alignment: .leading, spacing: Space.lg) {
                ForEach(week.days) { day in PlannerDayView(day: day, send: send) }
            }
            if week.state == .proposed {
                PlannerReviewView(week: week)
                PlannerAskView(week: week, note: state.note, isWorking: state.isWorking, send: send)
            }
        }
    }

    private var canUndo: Bool { (week.version ?? 1) > 1 && !state.isWorking }

    /// No draft yet, Coach drafting, or a failed draft.
    @ViewBuilder private var start: some View {
        switch week.state {
        case .none:
            VStack(alignment: .leading, spacing: Space.md) {
                Text("No plan for \(week.weekText) yet. Start with how last week went, then shape the week.")
                    .font(theme.font(.body))
                    .foregroundStyle(theme.palette.textSecondary)
                Button("Start with last week", systemImage: "arrow.right") { send(.tabChanged(.lastWeek)) }
                    .buttonStyle(.kobo(.primary, width: .full))
            }
            .koboCard()
        case .failed:
            VStack(alignment: .leading, spacing: Space.md) {
                InlineNotice(verbatim: week.errorText ?? String(localized: "The draft failed."), tone: .danger)
                Button("Try again", systemImage: "arrow.clockwise") { send(.draftTapped) }
                    .buttonStyle(.kobo(.primary, width: .full))
                    .disabled(state.isWorking)
            }
        case .drafting, .proposed:
            EmptyView()
        }
    }
}

/// What the last change did, line by line, and Undo.
struct PlannerChangeCard: View {
    @Environment(\.koboTheme) private var theme
    let change: PlannerWeek.Change
    let canUndo: Bool
    let send: (WeekPlannerAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            HStack(alignment: .firstTextBaseline) {
                Text(verbatim: change.note ?? String(localized: "Changed"))
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Button("Undo", systemImage: "arrow.uturn.backward") { send(.undoTapped) }
                    .buttonStyle(.kobo(.tonal, size: .compact))
                    .disabled(!canUndo)
            }
            ForEach(Array(change.changed.enumerated()), id: \.offset) { _, line in
                Text(verbatim: "\(line.what): \(line.how)")
                    .font(theme.font(.callout))
                    .foregroundStyle(theme.palette.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let gaveUp = change.gaveUp { InlineNotice(verbatim: gaveUp, tone: .warning) }
        }
        .koboCard()
    }
}

/// One day: its label and total, its sessions as one card, and the calendar events Coach planned around.
struct PlannerDayView: View {
    @Environment(\.koboTheme) private var theme
    let day: PlannerWeek.Day
    let send: (WeekPlannerAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            HStack {
                Text(verbatim: day.labelText).font(theme.font(.headline))
                Spacer(minLength: Space.sm)
                if let total = day.totalText {
                    Text(verbatim: total)
                        .font(theme.font(.subheadline).monospacedDigit())
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            if !day.sessions.isEmpty {
                WeekDayGroup(statuses: day.sessions.map { _ in .planned }) {
                    ForEach(Array(day.sessions.enumerated()), id: \.element.id) { offset, session in
                        if offset > 0 { WeekRowDivider() }
                        PlannerSessionRow(session: session) { send(.sessionTapped(session.index)) }
                    }
                }
            }
            ForEach(Array(day.calendar.enumerated()), id: \.offset) { _, event in
                Label {
                    Text(verbatim: "\(event.timeText)  \(event.title)").lineLimit(1)
                } icon: {
                    Image(systemName: "calendar")
                }
                .font(theme.font(.footnote))
                .foregroundStyle(theme.palette.textTertiary)
            }
        }
    }
}

/// One draft session as a Week card row: title and tags, then time, length and TSS.
struct PlannerSessionRow: View {
    @Environment(\.koboTheme) private var theme
    let session: PlannerWeek.Session
    let action: () -> Void

    var body: some View {
        WeekCard(status: .planned, sport: session.sportKind.color, action: action) {
            HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                Text(verbatim: session.title)
                    .font(theme.font(.callout).weight(.semibold))
                    .foregroundStyle(theme.palette.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if session.changed { KoboTag("Changed", tone: .info) }
                if session.hard { KoboTag("Hard", tone: .warning) }
            }
            HStack(spacing: Space.sm) {
                session.sportKind.icon.font(theme.font(.subheadline))
                Text(verbatim: details)
                    .font(theme.font(.subheadline).monospacedDigit())
                    .foregroundStyle(theme.palette.textSecondary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityHint(Text("Move, change the length or remove it"))
    }

    private var details: String {
        [session.timeText, session.lengthText, session.tssText].compactMap(\.self).joined(separator: " · ")
    }
}

/// The server's tone words ("good", "warn", "bad") as Kobo tones.
nonisolated enum PlannerTone {
    static func of(_ word: String) -> Tone {
        switch word {
        case "good": .success
        case "warn": .warning
        case "bad": .danger
        default: .neutral
        }
    }
}
