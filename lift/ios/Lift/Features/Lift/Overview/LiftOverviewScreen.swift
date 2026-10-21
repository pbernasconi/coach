import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4).
struct LiftOverviewScreen: View {
    @State private var viewModel: LiftOverviewViewModel

    init(viewModel: @autoclosure @escaping () -> LiftOverviewViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        LiftOverviewContent(state: viewModel.state, send: { viewModel.send($0) })
            .appRefreshable { await viewModel.send(.refreshPulled)?.value }
            .task { await viewModel.run() }
    }
}
