import KoboComponents
import KoboTokens
import SwiftUI

/// Step 3: what the week should do. The hours (his normal week is 8–10 h), then each goal and what it gets: lifts for
/// bigger arms, hard sessions for the engine, the long day, physio always in, and anything else. "Coach decides"
/// leaves it to Coach. The bar's Draft my week (or Redraw) sends it (SCR-2).
struct PlannerShapeStep: View {
    @Environment(\.koboTheme) private var theme
    let week: PlannerWeek
    let answers: PlannerAnswers
    let send: (WeekPlannerAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            SectionHeader(
                "What this week should do",
                subtitle: "Set from your goals and last week. Change any of them, or leave them to Coach."
            )
            VStack(alignment: .leading, spacing: Space.sm) {
                StepperField(
                    "Hours this week",
                    value: .action(answers.hours ?? week.suggested.hours ?? 9) { send(.hoursChanged($0)) },
                    in: 4...14,
                    unit: "h"
                )
                note(week.suggested.hoursText ?? String(localized: "Your normal week is 8–10 h."))
            }
            goal("Bigger arms", title: "Lifts", text: "Arm-first and full body, with curls in each.") {
                counts(answers.gym, options: [1, 2, 3]) { send(.liftsPicked($0)) }
            }
            goal("Faster engine", title: "Hard sessions", text: "Threshold and VO2 work, at least 48 h apart.") {
                counts(answers.hard, options: [0, 1, 2]) { send(.hardPicked($0)) }
            }
            goal("Keep long runs", title: "Long day", text: "The week's long run, easy all the way.") {
                FlowLayout {
                    Chip("Coach decides", isSelected: answers.longDay == nil) { send(.longDayPicked(nil)) }
                    ForEach(week.longDays) { day in
                        Chip(verbatim: day.text, isSelected: answers.longDay == day.date) {
                            send(.longDayPicked(answers.longDay == day.date ? nil : day.date))
                        }
                    }
                }
            }
            goal("Healthy tendons", title: "Physio", text: "A for Achilles and calf, B for knee and hip. Always in.") {
                EmptyView()
            }
            KoboTextArea(
                "Anything else for this week?",
                text: .action(answers.lock) { send(.anythingChanged($0)) },
                prompt: "A club ride Saturday, ride outside if it's dry",
                lines: 2...5,
                characterLimit: 500
            )
        }
    }

    /// One goal as a card: what it is for, what it gets, and the choice.
    private func goal(
        _ goal: LocalizedStringKey,
        title: LocalizedStringKey,
        text: LocalizedStringKey,
        @ViewBuilder choice: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            Text(goal)
                .font(theme.font(.caption).weight(.semibold))
                .textCase(.uppercase)
                .foregroundStyle(theme.palette.accentText)
            Text(title)
                .font(theme.font(.headline))
                .foregroundStyle(theme.palette.textPrimary)
            Text(text)
                .font(theme.font(.footnote))
                .foregroundStyle(theme.palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            choice()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .koboCard()
    }

    /// A count to pick, or Coach to leave it open; tapping the picked one goes back to Coach.
    private func counts(_ value: Int?, options: [Int], pick: @escaping (Int?) -> Void) -> some View {
        FlowLayout {
            Chip("Coach decides", isSelected: value == nil) { pick(nil) }
            ForEach(options, id: \.description) { option in
                Chip(verbatim: "\(option)", isSelected: value == option) { pick(value == option ? nil : option) }
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
