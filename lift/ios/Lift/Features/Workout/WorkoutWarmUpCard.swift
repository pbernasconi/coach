import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// The warm-up at the top of the workout: easy cardio and a few prep moves, each ticked with one tap or ignored. The
/// card folds to one line once every item is ticked; tapping that line opens it again. The warm-up sets themselves are
/// "W" rows in each exercise's set grid.
struct WorkoutWarmUpCard: View {
    @Environment(\.koboTheme) private var theme
    let checklist: WarmUpChecklist
    let isOpen: Bool
    let send: (WorkoutAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            header
            if !checklist.isComplete || isOpen {
                ListSection {
                    ForEach(Array(checklist.items.enumerated()), id: \.offset) { index, item in
                        WarmUpItemRow(item: item) { send(.warmUpItemTapped(index)) }
                    }
                } header: {
                    EmptyView()
                }
                .listSectionStyle(.grouped)
            }
        }
    }

    /// "Warm-up" and how many items are ticked; a button that folds or opens the card once it is done.
    @ViewBuilder private var header: some View {
        if checklist.isComplete {
            Button {
                send(.warmUpHeaderTapped)
            } label: {
                headerLabel(trailing: isOpen ? "chevron.up" : "chevron.down")
                    .frame(minHeight: Size.minTouch)
                    .contentShape(.rect)
            }
            .buttonStyle(.pressFeedback)
            .accessibilityHint(Text(isOpen ? "Folds the warm-up" : "Shows the warm-up"))
        } else {
            headerLabel(trailing: nil)
        }
    }

    private func headerLabel(trailing: String?) -> some View {
        HStack(spacing: Space.sm) {
            Image(systemName: checklist.isComplete ? "checkmark.circle.fill" : "flame.fill")
                .foregroundStyle(theme.palette.accentText)
                .accessibilityHidden(true)
            Text("Warm-up")
                .font(theme.font(.headline))
                .foregroundStyle(theme.palette.textPrimary)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: Space.sm)
            Text(verbatim: progress)
                .font(theme.font(.subheadline).monospacedDigit())
                .foregroundStyle(theme.palette.textSecondary)
            if let trailing {
                Image(systemName: trailing)
                    .font(theme.font(.footnote).weight(.semibold))
                    .foregroundStyle(theme.palette.textTertiary)
                    .accessibilityHidden(true)
            }
        }
    }

    /// "2 of 5", or "Done" once every item is ticked.
    private var progress: String {
        checklist.isComplete
            ? String(localized: "Done")
            : String(localized: "\(checklist.doneCount) of \(checklist.items.count)")
    }
}

/// One warm-up item: what to do ("Bird dog · 5 / side"), then its check.
private struct WarmUpItemRow: View {
    @Environment(\.koboTheme) private var theme
    let item: WarmUpChecklist.Item
    let onTap: () -> Void

    var body: some View {
        HStack(spacing: Space.md) {
            Text(verbatim: item.text)
                .font(theme.font(.body))
                .foregroundStyle(item.isDone ? theme.palette.textSecondary : theme.palette.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
            IconButton(
                "checkmark",
                verbatimAccessibilityLabel: item.isDone
                    ? String(localized: "Untick \(item.text)") : String(localized: "Tick \(item.text)"),
                style: item.isDone ? .solid : .tonal,
                size: .small,
                action: onTap
            )
            .transformEnvironment(\.koboTheme) { $0.surfaceStyle = .solid }
        }
        .frame(minHeight: Size.minTouch)
    }
}
