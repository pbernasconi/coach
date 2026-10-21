import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4).
struct TrainingScreen: View {
    @State private var viewModel: TrainingViewModel

    init(viewModel: @autoclosure @escaping () -> TrainingViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        TrainingContent(state: viewModel.state, send: { viewModel.send($0) })
            .appRefreshable { await viewModel.send(.refreshPulled)?.value }
            .task { await viewModel.run() }
    }
}
