import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// The warm-up at the top of the workout: easy cardio and a few prep moves, each ticked with one tap or ignored. A prep
/// move shows its catalog still; tapping the still or the name opens how it is done. The card folds to one line once
/// every item is ticked; tapping that line opens it again. The warm-up sets themselves are "W" rows in each exercise's
/// set grid.
struct WorkoutWarmUpCard: View {
    @Environment(\.koboTheme) private var theme
    let checklist: WarmUpChecklist
    let isOpen: Bool
    /// The catalog stills loaded so far, by catalog id (shared with the exercise sections).
    let thumbnails: [String: MediaImage]
    let send: (WorkoutAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            header
            if !checklist.isComplete || isOpen {
                ListSection {
                    ForEach(Array(checklist.items.enumerated()), id: \.offset) { index, item in
                        WarmUpItemRow(
                            item: item,
                            thumbnail: item.catalogID.map { thumbnails[$0] ?? .loading },
                            send: send
                        ) { send(.warmUpItemTapped(index)) }
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

/// One warm-up item: the move's still and what to do ("Dead bug · 5 / side"), then its check. The still and the name
/// open how the move is done; easy cardio has neither picture nor page.
private struct WarmUpItemRow: View {
    @Environment(\.koboTheme) private var theme
    let item: WarmUpChecklist.Item
    let thumbnail: MediaImage?
    let send: (WorkoutAction) -> Void
    let onTap: () -> Void

    var body: some View {
        HStack(spacing: Space.md) {
            move
                .frame(maxWidth: .infinity, alignment: .leading)
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
        .padding(.horizontal, SetGridWidth.inset)  // the set grid's inset, so the card lines up with the set tables
        .padding(.vertical, Space.xxs)
    }

    /// The still and the text; a button to the move's page when the catalog has it.
    @ViewBuilder private var move: some View {
        if let catalogID = item.catalogID {
            Button {
                send(.warmUpHowToTapped(catalogID: catalogID))
            } label: {
                label(catalogID: catalogID).contentShape(.rect)
            }
            .buttonStyle(.pressFeedback)
            .accessibilityHint(Text("Shows how to do it"))
        } else {
            label(catalogID: nil)
        }
    }

    private func label(catalogID: String?) -> some View {
        HStack(spacing: Space.sm) {
            if let catalogID, let thumbnail {
                ExerciseThumbnail(image: thumbnail, name: item.text, side: Size.minTouch)
                    .onAppear { send(.thumbnailNeeded(catalogID: catalogID)) }
                    .accessibilityHidden(true)
            }
            Text(verbatim: item.text)
                .font(theme.font(.body))
                .foregroundStyle(item.isDone ? theme.palette.textSecondary : theme.palette.textPrimary)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
