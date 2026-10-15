import KoboComponents
import KoboTokens
import SwiftUI

/// The day picker inside the "Move" sheet: a Kobo calendar limited to the days the strip shows, with the session's
/// current day selected and the other sessions marked. A tap moves the session at once.
struct WeekMovePicker: View {
    let move: WeekMove
    let today: Date
    let markers: [DayItem]
    let send: (WeekAction) -> Void

    var body: some View {
        KoboCalendar(
            today: today,
            selection: move.current,
            bounds: DateBounds(minDate: move.first, maxDate: move.last),
            markers: markers,
            onSelect: { send(.moveDayPicked(move.id, $0)) }
        )
    }
}
