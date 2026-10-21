import SwiftUI

/// Owns the ViewModel; renders Content; starts the read (SCR-2, SCR-4).
struct LiftSessionScreen: View {
    @State private var viewModel: LiftSessionViewModel

    init(viewModel: @autoclosure @escaping () -> LiftSessionViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        LiftSessionContent(state: viewModel.state, send: { viewModel.send($0) })
            .appRefreshable { await viewModel.send(.refreshPulled)?.value }
            .task { await viewModel.run() }
    }
}
