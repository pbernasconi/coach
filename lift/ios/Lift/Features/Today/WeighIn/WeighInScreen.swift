import SwiftUI

/// Owns the ViewModel; renders Content; starts the load (SCR-2, SCR-4).
struct WeighInScreen: View {
    @State private var viewModel: WeighInViewModel

    init(viewModel: @autoclosure @escaping () -> WeighInViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        WeighInContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
            .appRefreshable { await viewModel.send(.refreshPulled)?.value }
    }
}
