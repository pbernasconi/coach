import KoboComponents
import KoboTokens
import SwiftUI

/// The top of the Week screen, pinned above the list: the week strip, or the month calendar when the header's
/// calendar button asks for it. Each day has a dot per workout in its sport's colour; the selected day and today are in
/// ink, so the sport colours carry all the colour. It sits flat on the canvas with a hairline under it, so it reads as the header's part
/// and the workout cards below as the content.
struct WeekStripBar: View {
    @Environment(\.koboTheme) private var theme
    let strip: WeekStrip
    let mode: WeekState.CalendarMode
    let weekOffset: Int
    let send: (WeekAction) -> Void

    var body: some View {
        Group {
            switch mode {
            case .week:
                DayStrip(
                    items: strip.dayItems,
                    today: strip.today,
                    week: .action(weekOffset) { send(.weekChanged($0)) },
                    weeks: WeekState.weeks,
                    selection: strip.selected,
                    onSelect: { send(.daySelected($0)) }
                )
            case .month:
                KoboCalendar(
                    today: strip.today,
                    selection: strip.selected,
                    bounds: DateBounds(minDate: strip.range?.lowerBound, maxDate: strip.range?.upperBound),
                    markers: strip.dayItems,
                    density: .compact,
                    onSelect: { send(.daySelected($0)) }
                )
                .pageGutter()
            }
        }
        .dayHighlight(.ink)
        .padding(.bottom, Space.sm)
        .background(theme.palette.canvas)
        .overlay(alignment: .bottom) {
            Rectangle().fill(theme.palette.separator).frame(height: Size.hairline)
        }
    }
}

extension WeekStrip {
    /// The strip and calendar markers: one dot per workout in its sport's colour, filled once done, a ring while
    /// still to do.
    var dayItems: [DayItem] {
        days.map { day in
            let dots = day.workouts.map { workout in
                DayDot(light: workout.sport.hex.light, dark: workout.sport.hex.dark, isDone: workout.isDone)
            }
            return DayItem(date: day.date, marker: .dots(dots))
        }
    }
}
