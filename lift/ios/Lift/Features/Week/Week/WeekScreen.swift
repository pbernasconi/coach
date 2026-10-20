import KoboComponents
import KoboPatterns
import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4). Shows the ViewModel's toasts through Kobo's
/// `ToastCenter`, whose Undo action goes back through `send`.
struct WeekScreen: View {
    @State private var viewModel: WeekViewModel
    @State private var toasts = ToastCenter()

    init(viewModel: @autoclosure @escaping () -> WeekViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        WeekContent(state: viewModel.state, send: { viewModel.send($0) })
            .weekPlanRefresh(isOn: viewModel.state.plan != nil) { await viewModel.send(.refreshPulled)?.value }
            .task { await viewModel.run() }
            .onChange(of: viewModel.state.toast) { _, toast in show(toast) }
            .toastHost(toasts)
    }

    private func show(_ toast: WeekToast?) {
        guard let toast else { return }
        let viewModel = viewModel
        let undo = toast.undo.map { change in
            Toast.Action("Undo") {
                switch change {
                case .reschedule(let undo): viewModel.send(.undoTapped(undo))
                case .template(let undo): viewModel.send(.templateUndoTapped(undo))
                case .plan(let undo): viewModel.send(.planUndoTapped(undo))
                }
            }
        }
        toasts.show(Toast(verbatim: toast.message, action: undo))
    }
}

extension View {
    /// Pull to refresh fetches the coach plan again; it is there only while the plan is on, so the list behaves as
    /// before when sync is off.
    fileprivate func weekPlanRefresh(isOn: Bool, _ action: @escaping @Sendable () async -> Void) -> some View {
        modifier(WeekPlanRefresh(isOn: isOn, action: action))
    }
}

private struct WeekPlanRefresh: ViewModifier {
    let isOn: Bool
    let action: @Sendable () async -> Void

    func body(content: Content) -> some View {
        if isOn {
            content.koboRefreshable(action)
        } else {
            content
        }
    }
}
