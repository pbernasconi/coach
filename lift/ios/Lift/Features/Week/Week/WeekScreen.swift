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
            .task { await viewModel.run() }
            .appRefreshable { await viewModel.send(.refreshPulled)?.value }
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
                }
            }
        }
        toasts.show(Toast(verbatim: toast.message, action: undo))
    }
}
