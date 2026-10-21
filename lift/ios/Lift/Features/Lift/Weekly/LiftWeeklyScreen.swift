import SwiftUI

/// Owns the ViewModel; renders Content; starts the load (SCR-2, SCR-4).
struct LiftWeeklyScreen: View {
    @State private var viewModel: LiftWeeklyViewModel

    init(viewModel: @autoclosure @escaping () -> LiftWeeklyViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        LiftWeeklyContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
            .appRefreshable { await viewModel.send(.refreshPulled)?.value }
    }
}
