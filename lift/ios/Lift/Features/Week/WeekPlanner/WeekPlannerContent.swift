import KoboComponents
import KoboTokens
import SwiftUI

/// Dumb view: the full-screen planning page. Cancel closes it; Accept week opens the summary. Under the title, the
/// Week / Last week / Shape tabs, a line while Coach drafts or when a change did not happen, then the tab (SCR-2).
struct WeekPlannerContent: View {
    let state: WeekPlannerState
    let send: (WeekPlannerAction) -> Void

    var body: some View {
        ModalPage(
            verbatim: state.loaded?.titleText ?? String(localized: "Plan the week"),
            subtitle: state.loaded?.totalsText,
            confirmLabel: "Accept week",
            isConfirmEnabled: state.isProposed && !state.isWorking,
            closesOnConfirm: false,
            onConfirm: { send(.acceptTapped) }
        ) {
            VStack(alignment: .leading, spacing: Space.lg) {
                Picker("Section", selection: Binding.action(state.tab) { send(.tabChanged($0)) }) {
                    Text("Week").tag(WeekPlannerState.Tab.week)
                    Text("Last week").tag(WeekPlannerState.Tab.lastWeek)
                    Text("Shape").tag(WeekPlannerState.Tab.shape)
                }
                .pickerStyle(.segmented)
                status
                page
            }
            .padding(.bottom, Space.xxl)
        }
        .koboSheet(
            item: .action(state.openSession) { if $0 == nil { send(.destinationDismissed) } },
            title: { $0.title },
            subtitle: { session in [session.timeText, session.lengthText].compactMap(\.self).joined(separator: " · ") }
        ) { session in
            PlannerSessionSheet(session: session, isWorking: state.isWorking, send: send)
        }
        .koboSheet(
            item: .action(state.acceptWeek) { if $0 == nil { send(.destinationDismissed) } },
            title: { _ in String(localized: "Accept the week") },
            subtitle: { $0.weekText }
        ) { week in
            PlannerAcceptSheet(week: week, isWorking: state.isWorking, failure: state.failureText, send: send)
        }
    }

    /// Coach drafting, a refused or failed change, or nothing.
    @ViewBuilder private var status: some View {
        if state.isDrafting {
            InlineNotice(
                "Coach is drafting the week. It takes 1 to 3 minutes; you can close this and come back.",
                tone: .info
            )
        } else if let failure = state.failureText, state.destination == nil {
            InlineNotice(verbatim: failure, tone: .warning)
        }
    }

    private var page: some View {
        AppResourcePage(state.week, onRetry: { send(.retryTapped) }) { week in
            switch state.tab {
            case .week: PlannerWeekTab(week: week, state: state, send: send)
            case .lastWeek: PlannerLastWeekTab(week: week, answers: state.answers, send: send)
            case .shape: PlannerShapeTab(week: week, answers: state.answers, isWorking: state.isWorking, send: send)
            }
        }
    }
}
