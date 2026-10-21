import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4).
struct ActivityDetailScreen: View {
    @State private var viewModel: ActivityDetailViewModel

    init(viewModel: @autoclosure @escaping () -> ActivityDetailViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        ActivityDetailContent(state: viewModel.state, send: { viewModel.send($0) })
            .appRefreshable { await viewModel.send(.refreshPulled)?.value }
            .task { await viewModel.run() }
    }
}
