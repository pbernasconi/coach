import KoboComponents
import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4). Shows the ViewModel's toasts through Kobo's
/// `ToastCenter`.
struct CatalogDetailScreen: View {
    @State private var viewModel: CatalogDetailViewModel
    @State private var toasts = ToastCenter()

    init(viewModel: @autoclosure @escaping () -> CatalogDetailViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        CatalogDetailContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
            .onChange(of: viewModel.state.toast) { _, toast in show(toast) }
            .toastHost(toasts)
    }

    private func show(_ toast: CatalogToast?) {
        guard let toast else { return }
        switch toast.kind {
        case .added(let name):
            toasts.show(Toast("Added \(name) to your exercises", tone: .success))
        case .failed:
            toasts.show(Toast("Could not add it. Try again.", tone: .danger))
        }
    }
}
