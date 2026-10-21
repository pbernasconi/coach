import KoboComponents
import KoboTokens
import SwiftUI

/// This week: sessions done against the target with a bar, the seven days, four stats and the next session.
struct LiftWeekHero: View {
    @Environment(\.koboTheme) private var theme
    let week: LiftWeek
    let send: (LiftOverviewAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            VStack(alignment: .leading, spacing: Space.sm) {
                SectionHeader(verbatim: week.title)
                HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                    Text(verbatim: week.doneText)
                        .font(theme.font(.title).monospacedDigit())
                        .foregroundStyle(theme.palette.textPrimary)
                    Text(verbatim: week.caption)
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                    if week.targetMet {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(theme.palette.success.ink)
                            .accessibilityLabel(Text("Target met"))
                    }
                }
                .accessibilityElement(children: .combine)
                InlineProgress(
                    value: week.progress,
                    tone: week.targetMet ? .success : .accent,
                    accessibilityLabel: "Sessions this week"
                )
            }
            LiftWeekDays(days: week.days, send: send)
            LiftStatGrid(stats: week.stats)
            LiftNextUp(next: week.next, emptyText: week.nextEmptyText, send: send)
        }
    }
}

/// The week's seven days as Kobo's day strip: done days filled, planned days with a dot, today ringed. A day with a
/// session opens it.
struct LiftWeekDays: View {
    @Environment(\.calendar) private var calendar
    let days: [LiftWeekDay]
    let send: (LiftOverviewAction) -> Void

    var body: some View {
        let dated = days.compactMap { day in LiftDay.date(day.date, calendar: calendar).map { (day, $0) } }
        if let today = dated.first(where: { $0.0.today })?.1 ?? dated.first?.1 {
            DayStrip(
                items: dated.map { DayItem(date: $0.1, marker: Self.marker($0.0.state)) },
                today: today,
                week: .constant(0),
                weeks: 0...0
            ) { date in
                let day = dated.first { calendar.isDate($0.1, inSameDayAs: date) }?.0
                if let session = day?.sessionId { send(.sessionTapped(session)) }
            }
        }
    }

    static func marker(_ state: String) -> DayMarker {
        switch state {
        case "done": .done(.accent)
        case "planned": .planned(.accent)
        default: .none
        }
    }
}

/// The server's stats as tiles, two to a row (one at accessibility sizes). A streak of 2+ weeks carries the flame.
struct LiftStatGrid: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let stats: [LiftStat]

    var body: some View {
        let columns = Array(
            repeating: GridItem(.flexible(), spacing: Space.sm, alignment: .top),
            count: dynamicTypeSize.isAccessibilitySize ? 1 : 2
        )
        LazyVGrid(columns: columns, alignment: .leading, spacing: Space.sm) {
            ForEach(stats) { stat in
                StatTile(verbatim: stat.label, value: stat.value, delta: flame(stat)) {
                    if let detail = stat.detail, !stat.flame {
                        Text(verbatim: detail)
                            .font(theme.font(.caption))
                            .foregroundStyle(theme.palette.textSecondary)
                    }
                }
            }
        }
    }

    private func flame(_ stat: LiftStat) -> StatDelta? {
        guard stat.flame else { return nil }
        return StatDelta(verbatim: stat.detail ?? "", tone: .warning, symbol: "flame.fill")
    }
}

/// The next planned session as a tappable row, or the server's line when none is planned.
struct LiftNextUp: View {
    let next: LiftNext?
    let emptyText: String
    let send: (LiftOverviewAction) -> Void

    var body: some View {
        if let next {
            ListSection {
                ListRow(verbatim: next.title, subtitle: next.detail, action: { send(.sessionTapped(next.sessionId)) }) {
                    Image(systemName: "figure.strengthtraining.traditional").accessibilityHidden(true)
                } trailing: {
                    KoboTag(verbatim: next.whenText, tone: .accent)
                }
            } header: {
                EmptyView()
            }
        } else {
            LiftCaption(text: emptyText)
        }
    }
}
