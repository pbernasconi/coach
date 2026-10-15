import KoboComponents
import LiftCore
import SwiftUI

extension View {
    /// The template pickers: one plans a day from a template (or leaves it blank), the other changes a planned
    /// session's workout. A pick applies at once; Change workout offers Undo in a toast (product rule).
    func weekTemplatePickers(state: WeekState, send: @escaping (WeekAction) -> Void) -> some View {
        modifier(WeekTemplatePickers(state: state, send: send))
    }
}

/// Keeps the last target while a sheet slides away, so its rows do not empty out during the dismissal; that copy is
/// presentation state only.
private struct WeekTemplatePickers: ViewModifier {
    let state: WeekState
    let send: (WeekAction) -> Void
    @State private var addDay: WeekAddDay?
    @State private var changed: WeekSessionRef?

    func body(content: Content) -> some View {
        content
            .onChange(of: state.addTarget, initial: true) { _, new in
                if let new { addDay = new }
            }
            .onChange(of: state.changeTarget, initial: true) { _, new in
                if let new { changed = new }
            }
            .koboActionSheet(
                isPresented: .action(state.addTarget != nil) { if !$0 { send(.destinationDismissed) } },
                verbatim: String(localized: "Add workout"),
                message: addDay?.dayTitle
            ) {
                if let day = addDay?.id {
                    for template in state.templates {
                        ActionSheetItem(verbatim: template.name, systemImage: "list.bullet", id: template.id.uuidString)
                        {
                            send(.templatePicked(template.id, on: day))
                        }
                    }
                    ActionSheetItem("Blank workout", systemImage: "plus") { send(.blankWorkoutPicked(day)) }
                }
            }
            .koboActionSheet(
                isPresented: .action(state.changeTarget != nil) { if !$0 { send(.destinationDismissed) } },
                verbatim: String(localized: "Change \(changed?.title ?? "")"),
                message: changed?.dayTitle
            ) {
                if let session = changed {
                    for template in state.templates.filter({ $0.id != session.templateID }) {
                        ActionSheetItem(verbatim: template.name, systemImage: "list.bullet", id: template.id.uuidString)
                        {
                            send(.changeTemplatePicked(session.id, to: template.id))
                        }
                    }
                }
            }
    }
}
