import KoboComponents
import KoboTokens
import SwiftUI

/// The six headline numbers on one card, two to a row (one at accessibility sizes), then PRs and kudos, then a
/// row to "All stats".
struct ActivityStatGrid: View {
    let overview: ActivityOverview
    let onMore: () -> Void
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            WorkoutStatGrid(items: overview.gridStats, id: \.label) { stat in
                WorkoutStatCell(label: stat.label, value: stat.valueText, unit: stat.unit)
            }
            if let achievements = overview.achievementsText {
                Label {
                    Text(verbatim: achievements)
                } icon: {
                    Image(systemName: "trophy.fill")
                        .foregroundStyle(theme.palette.warning.ink)
                        .accessibilityHidden(true)
                }
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textSecondary)
            }
            if !overview.moreStats.isEmpty {
                VStack(spacing: 0) {
                    Separator()
                    ActivitySeeAll(
                        verbatim: String(localized: "All stats"),
                        value: "\(overview.moreStats.count)",
                        action: onMore
                    )
                }
                .padding(.bottom, -Space.sm)
            }
        }
        .koboCard()
    }
}

/// A quiet row that opens a full page: the title, a count or value, and a chevron.
struct ActivitySeeAll: View {
    let verbatim: String
    var value: String?
    let action: () -> Void
    @Environment(\.koboTheme) private var theme

    var body: some View {
        Button(action: action) {
            HStack(spacing: Space.sm) {
                Text(verbatim: verbatim).foregroundStyle(theme.palette.textPrimary)
                Spacer(minLength: Space.sm)
                if let value { Text(verbatim: value).foregroundStyle(theme.palette.textSecondary) }
                Image(systemName: "chevron.right")
                    .font(theme.font(.footnote).weight(.semibold))
                    .foregroundStyle(theme.palette.textTertiary)
                    .accessibilityHidden(true)
            }
            .font(theme.font(.body))
            .frame(minHeight: Size.minTouch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// One row of a short list: a title, an optional line under it, a value, and a trophy when it is the best.
nonisolated struct ActivityTopRow: Identifiable, Equatable, Sendable {
    var id: String
    var title: String
    var value: String
    var detail: String?
    var isBest = false
}

/// The first few rows of a table, then "See all" when there are more (or when the full table has more columns).
struct ActivityTopRows: View {
    let rows: [ActivityTopRow]
    let total: Int
    let onAll: () -> Void
    @Environment(\.koboTheme) private var theme

    var body: some View {
        ListSection {
                ForEach(rows) { row in
                    ListRow(verbatim: row.title, subtitle: row.detail, value: row.value) {
                        Image(systemName: row.isBest ? "trophy.fill" : "circle.fill")
                            .font(theme.font(.footnote))
                            .foregroundStyle(row.isBest ? theme.palette.warning.ink : theme.palette.separator)
                            .accessibilityLabel(row.isBest ? Text("Best") : Text(verbatim: ""))
                    }
                }
                ListRow(verbatim: String(localized: "See all"), value: "\(total)", action: onAll)
        }
    }
}

/// The load this activity added: TSS, then fitness and form after the day, with how TSS was worked out under it.
struct ActivityLoadRow: View {
    let coach: ActivityCoach
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            HStack(alignment: .top, spacing: Space.md) {
                WorkoutStatCell(label: "TSS", value: coach.load.tssText, size: .compact)
                ForEach(coach.load.rows.filter { $0.key == "ctl" || $0.key == "tsb" }, id: \.key) { row in
                    WorkoutStatCell(label: row.label, value: row.valueText, size: .compact)
                }
            }
            if let method = coach.load.methodText ?? coach.load.emptyText {
                Text(verbatim: method).font(theme.font(.footnote)).foregroundStyle(theme.palette.textSecondary)
            }
        }
        .koboCard()
    }
}
