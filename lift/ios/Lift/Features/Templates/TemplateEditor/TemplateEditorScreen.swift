import KoboComponents
import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4). Shows the ViewModel's toasts through Kobo's
/// `ToastCenter`, whose Undo action goes back through `send`.
struct TemplateEditorScreen: View {
    @State private var viewModel: TemplateEditorViewModel
    @State private var toasts = ToastCenter()

    init(viewModel: @autoclosure @escaping () -> TemplateEditorViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        TemplateEditorContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
            .onChange(of: viewModel.state.toast) { _, toast in show(toast) }
            .toastHost(toasts)
    }

    private func show(_ toast: TemplateEditorToast?) {
        guard let toast else { return }
        switch toast.kind {
        case .removed(let id):
            let viewModel = viewModel
            let undo = Toast.Action("Undo") { viewModel.send(.removeUndoTapped(id)) }
            toasts.show(Toast("Exercise removed", action: undo))
        case .failed:
            toasts.show(Toast("Could not save. Try again.", tone: .danger))
        }
    }
}
