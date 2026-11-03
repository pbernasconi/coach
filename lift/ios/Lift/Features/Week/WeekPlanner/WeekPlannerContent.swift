import KoboComponents
import KoboTokens
import SwiftUI

/// Dumb view: the full-screen planning page in five steps (last week, your week, priorities, draft, review). The
/// progress header says where Paolo is; Back and Next sit in the bottom bar, and Review's is Accept and sync. Accept
/// in the top bar jumps to Review once there is a draft (SCR-2).
struct WeekPlannerContent: View {
    let state: WeekPlannerState
    let send: (WeekPlannerAction) -> Void

    var body: some View {
        ModalPage(
            verbatim: state.loaded?.titleText ?? String(localized: "Plan the week"),
            subtitle: state.loaded?.totalsText,
            confirmLabel: "Accept",
            isConfirmEnabled: state.isProposed && !state.isWorking,
            closesOnConfirm: false,
            onConfirm: { send(.acceptTapped) }
        ) {
            VStack(alignment: .leading, spacing: Space.lg) {
                PlannerStepHeader(step: state.step)
                status
                page
            }
            .padding(.bottom, Space.xxl)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if state.loaded != nil { PlannerStepBar(state: state, send: send) }
        }
        .koboSheet(
            item: .action(state.openSession) { if $0 == nil { send(.destinationDismissed) } },
            title: { $0.title },
            subtitle: { session in [session.timeText, session.lengthText].compactMap(\.self).joined(separator: " · ") }
        ) { session in
            PlannerSessionSheet(session: session, isWorking: state.isWorking, send: send)
        }
    }

    /// Coach drafting, a refused or failed change, or nothing.
    @ViewBuilder private var status: some View {
        if state.isDrafting, state.step == .draft {
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
            switch state.step {
            case .lastWeek: PlannerLastWeekStep(week: week, answers: state.answers, send: send)
            case .days: PlannerDaysStep(week: week, answers: state.answers, send: send)
            case .shape: PlannerShapeStep(week: week, answers: state.answers, send: send)
            case .draft: PlannerWeekTab(week: week, state: state, send: send)
            case .review: PlannerReviewStep(week: week)
            }
        }
    }
}

/// "Step 2 of 5 · Your week" over five segments, the done ones filled.
struct PlannerStepHeader: View {
    @Environment(\.koboTheme) private var theme
    let step: WeekPlannerState.Step

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Text("Step \(step.rawValue + 1) of \(WeekPlannerState.Step.allCases.count) · \(Text(step.title))")
                .font(theme.font(.footnote).weight(.semibold))
                .foregroundStyle(theme.palette.textSecondary)
            SegmentedProgress(
                done: step.rawValue + 1,
                goal: WeekPlannerState.Step.allCases.count,
                accessibilityLabel: "Planning steps"
            )
        }
    }
}

/// Back and the step's forward button: Next, Draft my week (or Redraw), or Accept and sync.
struct PlannerStepBar: View {
    let state: WeekPlannerState
    let send: (WeekPlannerAction) -> Void

    var body: some View {
        PinnedFooter {
            HStack(spacing: Space.sm) {
                if state.step != .lastWeek {
                    Button("Back") { send(.backTapped) }
                        .buttonStyle(.kobo(.secondary))
                }
                forward.frame(maxWidth: .infinity)
            }
        }
    }

    @ViewBuilder private var forward: some View {
        switch state.step {
        case .lastWeek, .days:
            Button(state.step == .lastWeek ? "Next: your week" : "Next: priorities", systemImage: "arrow.right") {
                send(.nextTapped)
            }
            .buttonStyle(.kobo(.primary, width: .full))
        case .shape:
            Button(state.isProposed ? "Redraw with these answers" : "Draft my week", systemImage: "sparkles") {
                send(.draftTapped)
            }
            .buttonStyle(.kobo(.primary, width: .full))
            .disabled(state.isWorking || state.isDrafting)
        case .draft:
            Button("Next: review", systemImage: "arrow.right") { send(.nextTapped) }
                .buttonStyle(.kobo(.primary, width: .full))
                .disabled(!state.isProposed || state.isWorking)
        case .review:
            Button(state.isWorking ? "Accepting…" : "Accept and sync", systemImage: "checkmark") {
                send(.acceptConfirmed)
            }
            .buttonStyle(.kobo(.primary, width: .full))
            .disabled(!state.isProposed || state.isWorking)
        }
    }
}
