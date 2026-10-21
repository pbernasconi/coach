import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// Dumb view: the coach's weekly volume, newest week first, each with a bar against the largest week (SCR-2).
struct LiftWeeklyContent: View {
    let state: LiftWeeklyState
    let send: (LiftWeeklyAction) -> Void

    var body: some View {
        ScrollView {
            AppResourcePage(state.weekly, onRetry: { send(.retryTapped) }) { weekly in
                AppSectionView(nil, section: weekly.weeks) { weeks in
                    LiftWeeklyWeeksView(weeks: weeks)
                }
            }
            .pageColumn()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .navigationTitle(Text(verbatim: title))
        .navigationBarTitleDisplayMode(.inline)
    }

    /// The server's title ("Weekly volume") once loaded.
    private var title: String {
        state.weekly.content.value?.weeks.value?.title ?? String(localized: "Weekly volume")
    }
}

/// The caption, then one row per week, or the server's empty text.
private struct LiftWeeklyWeeksView: View {
    @Environment(\.koboTheme) private var theme
    let weeks: LiftWeeklyWeeks

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            Text(verbatim: weeks.caption)
                .font(theme.font(.footnote))
                .foregroundStyle(theme.palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            if weeks.items.isEmpty {
                SectionState(verbatim: weeks.emptyText)
            } else {
                ListSection {
                    ForEach(weeks.items) { LiftWeeklyRowView(row: $0) }
                }
            }
        }
    }
}

/// One week: its Monday, sessions and sets, the volume, and a bar against the largest week. An empty week is quiet.
private struct LiftWeeklyRowView: View {
    @Environment(\.koboTheme) private var theme
    let row: LiftWeeklyRow

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                Text(verbatim: row.weekText)
                    .font(theme.font(.body).weight(isEmpty ? .regular : .semibold))
                    .foregroundStyle(isEmpty ? theme.palette.textSecondary : theme.palette.textPrimary)
                Spacer(minLength: Space.sm)
                Text(verbatim: row.volumeText)
                    .font(theme.font(.body).monospacedDigit())
                    .foregroundStyle(isEmpty ? theme.palette.textTertiary : theme.palette.textPrimary)
            }
            Text(LiftWeeklyText.counts(sessions: row.sessions, sets: row.sets))
                .font(theme.font(.footnote).monospacedDigit())
                .foregroundStyle(theme.palette.textSecondary)
            if !isEmpty {
                InlineProgress(value: row.relative, total: 1, accessibilityLabel: "Volume")
                    .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, Space.cardInset)
        .padding(.vertical, Space.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private var isEmpty: Bool { row.sessions == 0 }
}

/// Plain labels for the weekly volume rows.
nonisolated enum LiftWeeklyText {
    /// "1 session · 18 sets", "No sessions".
    static func counts(sessions: Int, sets: Double) -> String {
        guard sessions > 0 else { return String(localized: "No sessions") }
        let setCount = Int(sets.rounded())
        let text = AttributedString(
            localized: "^[\(sessions) session](inflect: true) · ^[\(setCount) set](inflect: true)"
        )
        return String(text.characters)
    }
}
