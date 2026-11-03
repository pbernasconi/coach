import KoboComponents
import KoboTokens
import SwiftUI

/// The Shape tab: the hours, lifts, hard days, long day and days off Coach drafts with ("Coach" leaves it to Coach),
/// what is on the calendar, then Draft (or Redraw once there is a draft) (SCR-2).
struct PlannerShapeTab: View {
    @Environment(\.koboTheme) private var theme
    let week: PlannerWeek
    let answers: PlannerAnswers
    let isWorking: Bool
    let send: (WeekPlannerAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            VStack(alignment: .leading, spacing: Space.sm) {
                StepperField(
                    "Hours this week",
                    value: .action(answers.hours ?? week.suggested.hours ?? 8) { send(.hoursChanged($0)) },
                    in: 2...20,
                    unit: "h"
                )
                if let text = week.suggested.hoursText { note(text) }
            }
            choices("Lifts", value: answers.gym, options: [1, 2, 3]) { send(.liftsPicked($0)) }
            choices("Hard sessions", value: answers.hard, options: [0, 1, 2]) { send(.hardPicked($0)) }
            longDay
            daysOff
            if !week.planningAround.isEmpty {
                VStack(alignment: .leading, spacing: Space.xs) {
                    SectionHeader("Planning around")
                    ForEach(Array(week.planningAround.enumerated()), id: \.offset) { _, line in note(line) }
                }
            }
            Button(week.state == .proposed ? "Redraw with these answers" : "Draft my week", systemImage: "sparkles") {
                send(.draftTapped)
            }
            .buttonStyle(.kobo(.primary, width: .full))
            .disabled(isWorking || week.state == .drafting)
        }
    }

    /// A count to pick, or Coach to leave it open; tapping the picked one goes back to Coach.
    private func choices(
        _ title: LocalizedStringKey,
        value: Int?,
        options: [Int],
        pick: @escaping (Int?) -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            SectionHeader(title)
            FlowLayout {
                Chip("Coach decides", isSelected: value == nil) { pick(nil) }
                ForEach(options, id: \.description) { option in
                    Chip(verbatim: "\(option)", isSelected: value == option) { pick(value == option ? nil : option) }
                }
            }
        }
    }

    private var longDay: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            SectionHeader("Long day")
            FlowLayout {
                Chip("Coach decides", isSelected: answers.longDay == nil) { send(.longDayPicked(nil)) }
                ForEach(week.longDays) { day in
                    Chip(verbatim: day.text, isSelected: answers.longDay == day.date) {
                        send(.longDayPicked(answers.longDay == day.date ? nil : day.date))
                    }
                }
            }
        }
    }

    private var daysOff: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            SectionHeader("Days off")
            FlowLayout {
                ForEach(week.days) { day in
                    Chip(verbatim: day.labelText, isSelected: answers.daysOff.contains(day.date)) {
                        send(.dayOffToggled(day.date))
                    }
                }
            }
        }
    }

    private func note(_ text: String) -> some View {
        Text(verbatim: text)
            .font(theme.font(.footnote))
            .foregroundStyle(theme.palette.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
    }
}
