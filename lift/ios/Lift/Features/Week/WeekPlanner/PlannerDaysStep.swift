import KoboComponents
import KoboTokens
import SwiftUI

/// Step 2: the week on Paolo's calendar. Each day shows its free windows and what is on the calendar, and he marks it
/// free, off (no training) or away (travel: no gym). Days already gone are kept as they were (SCR-2).
struct PlannerDaysStep: View {
    @Environment(\.koboTheme) private var theme
    let week: PlannerWeek
    let answers: PlannerAnswers
    let send: (WeekPlannerAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            SectionHeader(
                "What your week looks like",
                subtitle: "From Google Calendar. Mark the days that are off or away, and Coach plans around the rest."
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
        return VStack(alignment: .leading, spacing: Space.xs) {
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
            Text(verbatim: line(day, mode))
                .font(theme.font(.footnote))
                .foregroundStyle(mode == .free ? theme.palette.success.ink : theme.palette.textSecondary)
            if !day.past {
                HStack(spacing: Space.xs) {
                    ForEach(PlannerAnswers.DayMode.allCases, id: \.self) { option in
                        Chip(verbatim: label(option), isSelected: mode == option) {
                            send(.dayModePicked(day.date, option))
                        }
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
        .padding(.bottom, Space.xs)
    }

    private func line(_ day: PlannerWeek.Day, _ mode: PlannerAnswers.DayMode) -> String {
        if day.past { return day.freeText }
        switch mode {
        case .off: return String(localized: "No training")
        case .away: return String(localized: "Away: no gym, runs or rest")
        case .free: return day.freeText
        }
    }

    private func label(_ mode: PlannerAnswers.DayMode) -> String {
        switch mode {
        case .free: String(localized: "Free")
        case .off: String(localized: "Off")
        case .away: String(localized: "Away")
        }
    }

    private var countText: String {
        let open = week.days.filter { !$0.past }
        let free = open.filter { answers.mode(of: $0.date) == .free }.count
        let away = open.filter { answers.mode(of: $0.date) == .away }.count
        return away > 0
            ? String(localized: "\(free) free days, \(away) away.")
            : String(localized: "\(free) free days.")
    }
}
