import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4).
struct CatalogScreen: View {
    @State private var viewModel: CatalogViewModel

    init(viewModel: @autoclosure @escaping () -> CatalogViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        CatalogContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
    }
}
