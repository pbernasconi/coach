import KoboComponents
import KoboTokens
import SwiftUI

/// The week strip, pinned above the list on the canvas colour so the list scrolls under it.
struct WeekStripBar: View {
    @Environment(\.koboTheme) private var theme
    let strip: WeekStrip
    let weekOffset: Int
    let send: (WeekAction) -> Void

    var body: some View {
        DayStrip(
            items: strip.dayItems,
            today: strip.today,
            week: .action(weekOffset) { send(.weekChanged($0)) },
            weeks: WeekState.weeks,
            selection: strip.selected,
            onSelect: { send(.daySelected($0)) }
        )
        .padding(.vertical, Space.md)
        .koboCard(padding: 0)
        .pageGutter()
        .padding(.bottom, Space.sm)
        .background(theme.palette.canvas)
    }
}

extension WeekStrip {
    /// The strip and calendar markers: a dot while something is planned, a filled day once all is done.
    var dayItems: [DayItem] {
        days.map { day in
            switch day.status {
            case .planned: DayItem(date: day.date, marker: .planned(.accent))
            case .done: DayItem(date: day.date, marker: .done(.accent))
            }
        }
    }
}
