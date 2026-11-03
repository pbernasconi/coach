import KoboComponents
import KoboTokens
import SwiftUI

/// Step 2: the week on Paolo's calendar. Each day shows its all-day events first, then its free windows and what is
/// on the calendar; he says what the day is (free, busy, travelling, rest or sick) and can add a note for it. Days
/// already gone are kept as they were (SCR-2).
struct PlannerDaysStep: View {
    @Environment(\.koboTheme) private var theme
    let week: PlannerWeek
    let answers: PlannerAnswers
    let send: (WeekPlannerAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            SectionHeader(
                "What your week looks like",
                subtitle: "From Google Calendar. Say what each day is, and Coach plans around it."
            )
            VStack(alignment: .leading, spacing: Space.lg) {
                ForEach(week.days) { day in row(day) }
            }
            Text(verbatim: countText)
                .font(theme.font(.footnote))
                .foregroundStyle(theme.palette.textSecondary)
        }
    }

    private func row(_ day: PlannerWeek.Day) -> some View {
        let mode = answers.mode(of: day.date)
        return VStack(alignment: .leading, spacing: Space.sm) {
            HStack(alignment: .firstTextBaseline) {
                Text(verbatim: day.labelText)
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if day.past {
                    Text("Past").font(theme.font(.footnote)).foregroundStyle(theme.palette.textTertiary)
                }
            }
            .accessibilityAddTraits(.isHeader)
            allDay(day)
            Text(verbatim: line(day, mode))
                .font(theme.font(.footnote))
                .foregroundStyle(mode == .free ? theme.palette.success.ink : theme.palette.textSecondary)
            if !day.past { controls(day, mode) }
            ForEach(Array(day.calendar.filter { !$0.allDay }.enumerated()), id: \.offset) { _, event in
                Label {
                    Text(verbatim: "\(event.timeText)  \(event.title)").lineLimit(1)
                } icon: {
                    Image(systemName: "calendar")
                }
                .font(theme.font(.footnote))
                .foregroundStyle(theme.palette.textTertiary)
            }
        }
        .padding(.bottom, Space.xs)
    }

    /// The day type chips and the note box.
    private func controls(_ day: PlannerWeek.Day, _ mode: PlannerAnswers.DayMode) -> some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            FlowLayout(spacing: Space.xs, lineSpacing: Space.xs) {
                ForEach(PlannerAnswers.DayMode.allCases) { option in
                    Chip(verbatim: Self.label(option), isSelected: mode == option) {
                        send(.dayModePicked(day.date, option))
                    }
                }
            }
            KoboTextField(
                verbatim: String(localized: "Note for \(day.labelText)"),
                text: .action(answers.notes[day.date] ?? "") { send(.dayNoteChanged(day.date, $0)) },
                prompt: String(localized: "Dinner at 7, hotel has a gym…")
            )
        }
    }

    /// The day's all-day events at the top, as in a calendar app.
    @ViewBuilder private func allDay(_ day: PlannerWeek.Day) -> some View {
        let events = day.calendar.filter(\.allDay)
        if !events.isEmpty {
            FlowLayout(spacing: Space.xs, lineSpacing: Space.xs) {
                ForEach(Array(events.enumerated()), id: \.offset) { _, event in
                    Text(verbatim: event.title)
                        .font(theme.font(.caption).weight(.medium))
                        .foregroundStyle(theme.palette.warning.ink)
                        .lineLimit(1)
                        .padding(.horizontal, Space.sm)
                        .padding(.vertical, Space.xxs)
                        .background(theme.palette.warning.soft, in: RoundedRectangle(cornerRadius: Radius.sm))
                }
            }
        }
    }

    private func line(_ day: PlannerWeek.Day, _ mode: PlannerAnswers.DayMode) -> String {
        if day.past { return day.freeText }
        switch mode {
        case .free: return day.freeText
        case .busy: return String(localized: "One short session, 45 min at most")
        case .travel: return String(localized: "Travelling: no gym, runs, bodyweight or rest")
        case .rest: return String(localized: "No training")
        case .sick: return String(localized: "No training, then ease back in")
        }
    }

    static func label(_ mode: PlannerAnswers.DayMode) -> String {
        switch mode {
        case .free: String(localized: "Free")
        case .busy: String(localized: "Busy")
        case .travel: String(localized: "Travelling")
        case .rest: String(localized: "Rest")
        case .sick: String(localized: "Sick")
        }
    }

    private var countText: String {
        let open = week.days.filter { !$0.past }
        let free = open.filter { answers.mode(of: $0.date) == .free }.count
        let others = PlannerAnswers.DayMode.allCases.dropFirst().compactMap { mode -> String? in
            let count = open.filter { answers.mode(of: $0.date) == mode }.count
            return count > 0 ? "\(count) \(Self.label(mode).lowercased())" : nil
        }
        return ([String(localized: "\(free) free days")] + others).joined(separator: ", ") + "."
    }
}
