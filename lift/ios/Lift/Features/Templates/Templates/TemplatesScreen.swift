import KoboComponents
import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4). Shows the ViewModel's toasts through Kobo's
/// `ToastCenter`, whose Undo action goes back through `send`.
struct TemplatesScreen: View {
    @State private var viewModel: TemplatesViewModel
    @State private var toasts = ToastCenter()

    init(viewModel: @autoclosure @escaping () -> TemplatesViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        TemplatesContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
            .onChange(of: viewModel.state.toast) { _, toast in show(toast) }
            .toastHost(toasts)
    }

    private func show(_ toast: TemplatesToast?) {
        guard let toast else { return }
        switch toast.kind {
        case .removed(let id, let name):
            let viewModel = viewModel
            let undo = Toast.Action("Undo") { viewModel.send(.undoRemoveTapped(id)) }
            toasts.show(Toast(verbatim: String(localized: "Removed \(name)"), action: undo))
        case .failed:
            toasts.show(Toast("Could not save. Try again.", tone: .danger))
        }
    }
}
