import KoboTokens
import SwiftUI

/// "Next week · Nov 9–15 ⌄" over the steps: a menu of the weeks the coach offers (this week and the seven after it).
/// Picking one opens the planner on that week.
struct PlannerWeekPicker: View {
    @Environment(\.koboTheme) private var theme
    let week: PlannerWeek
    let isWorking: Bool
    let send: (WeekPlannerAction) -> Void

    var body: some View {
        Menu {
            Picker(selection: selection) {
                ForEach(week.weeks) { choice in
                    Text(verbatim: choice.menuText).tag(choice.weekStart)
                }
            } label: {
                Text("Week to plan")
            }
        } label: {
            HStack(spacing: Space.xs) {
                Image(systemName: "calendar").accessibilityHidden(true)
                Text(verbatim: current)
                Image(systemName: "chevron.down")
                    .accessibilityHidden(true)
                    .font(theme.font(.caption).weight(.bold))
                    .foregroundStyle(theme.palette.textSecondary)
            }
            .font(theme.font(.subheadline).weight(.semibold))
            .foregroundStyle(theme.palette.textPrimary)
            .padding(.horizontal, Space.md)
            .padding(.vertical, Space.sm)
            .background(theme.palette.surfaceSunken, in: Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(isWorking)
        .accessibilityLabel(Text("Week to plan: \(current)"))
    }

    private var current: String {
        week.weeks.first { $0.weekStart == week.weekStart }?.menuText ?? week.weekText
    }

    private var selection: Binding<String> {
        Binding(get: { week.weekStart }, set: { send(.weekPicked($0)) })
    }
}
