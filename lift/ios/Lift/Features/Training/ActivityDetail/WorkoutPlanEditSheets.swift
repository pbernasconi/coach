import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

extension View {
    /// The bar's "Move to another day" (a calendar of the Week tab's weeks; a tap moves the workout at once) and
    /// "Delete workout" (asked first: a delete has no undo).
    func workoutPlanEdits(state: ActivityDetailState, send: @escaping (ActivityDetailAction) -> Void) -> some View {
        let title = state.plan?.title ?? ""
        return koboSheet(
            item: .action(state.moveDay) { if $0 == nil { send(.destinationDismissed) } },
            title: { String(localized: "Move \($0.title)") },
            subtitle: { $0.dayTitle }
        ) { move in
            KoboCalendar(
                today: move.today,
                selection: move.current,
                bounds: DateBounds(minDate: move.first, maxDate: move.last),
                onSelect: { send(.moveDayPicked($0)) }
            )
        }
        // A sheet, not the system dialog: on iOS 26 the dialog is a popover from the bar that leaves out Cancel.
        .koboConfirm(
            isPresented: .action(state.isConfirmingDelete) { if !$0 { send(.destinationDismissed) } },
            .destructive(
                verbatim: String(localized: "Delete \(title)?"),
                message: String(localized: "It leaves the plan, the web and your calendar. This cannot be undone."),
                confirmLabel: "Delete workout"
            ) { send(.deleteConfirmed) },
            style: .sheet
        )
    }
}
