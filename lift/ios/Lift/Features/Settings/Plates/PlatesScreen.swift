import KoboComponents
import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4). Shows "Reset to defaults" with its Undo through
/// the tab's Kobo `ToastCenter`, whose action goes back through `send`.
struct PlatesScreen: View {
    @State private var viewModel: PlatesViewModel
    private let toasts: ToastCenter

    init(viewModel: @autoclosure @escaping () -> PlatesViewModel, toasts: ToastCenter) {
        _viewModel = State(wrappedValue: viewModel())
        self.toasts = toasts
    }

    var body: some View {
        PlatesContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
            .onChange(of: viewModel.state.toast) { _, toast in show(toast) }
    }

    private func show(_ toast: PlatesToast?) {
        guard let toast else { return }
        let viewModel = viewModel
        let undo = Toast.Action("Undo") { viewModel.send(.resetUndoTapped(toast.previous)) }
        toasts.show(Toast("Reset to defaults", action: undo))
    }
}
