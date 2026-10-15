import KoboComponents
import SwiftUI

extension View {
    /// The lift sheet for a planned session: move, change the workout, push a week or remove. Each choice applies at once and the screen
    /// offers Undo in a toast, so nothing here asks for confirmation (product rule).
    func weekSessionOptions(target: WeekSessionRef?, send: @escaping (WeekAction) -> Void) -> some View {
        modifier(WeekSessionOptions(target: target, send: send))
    }
}

/// Presents the Kobo action sheet while `target` is set. It keeps the last target while the sheet slides away, so the
/// rows do not empty out during the dismissal; that copy is presentation state only.
private struct WeekSessionOptions: ViewModifier {
    let target: WeekSessionRef?
    let send: (WeekAction) -> Void
    @State private var shown: WeekSessionRef?

    func body(content: Content) -> some View {
        content
            .onChange(of: target, initial: true) { _, new in
                if let new { shown = new }
            }
            .koboActionSheet(
                isPresented: .action(target != nil) { if !$0 { send(.destinationDismissed) } },
                verbatim: shown?.title ?? "",
                message: shown?.dayTitle
            ) {
                if let id = shown?.id {
                    ActionSheetItem("Move to another day", systemImage: "calendar") { send(.moveTapped(id)) }
                    if shown?.canChangeWorkout == true {
                        ActionSheetItem("Change workout", systemImage: "arrow.triangle.2.circlepath") {
                            send(.changeWorkoutTapped(id))
                        }
                    }
                    ActionSheetItem("Push to next week", systemImage: "arrow.right.to.line") {
                        send(.pushToNextWeekTapped(id))
                    }
                    ActionSheetItem("Remove", systemImage: "trash", role: .destructive) { send(.removeTapped(id)) }
                }
            }
    }
}
