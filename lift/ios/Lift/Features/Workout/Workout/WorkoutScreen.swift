import KoboComponents
import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4). Runs the rest countdown for each new rest and
/// shows the ViewModel's toasts through Kobo's `ToastCenter`, whose Undo action goes back through `send`.
struct WorkoutScreen: View {
    @State private var viewModel: WorkoutViewModel
    @State private var toasts = ToastCenter()

    init(viewModel: @autoclosure @escaping () -> WorkoutViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        WorkoutContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
            .task(id: viewModel.state.rest?.run) { await viewModel.runRestTimer() }
            .onChange(of: viewModel.state.toast) { _, toast in show(toast) }
            .toastHost(toasts)
    }

    private func show(_ toast: WorkoutToast?) {
        guard let toast else { return }
        switch toast.kind {
        case .removed(let setID):
            let viewModel = viewModel
            let undo = Toast.Action("Undo") { viewModel.send(.removeUndoTapped(setID)) }
            toasts.show(Toast("Set removed", action: undo))
        case .failed:
            toasts.show(Toast("Could not save. Try again.", tone: .danger))
        }
    }
}
