import SwiftUI

/// Owns the ViewModel; renders Content; starts the load (SCR-2, SCR-4).
struct PlannedWorkoutScreen: View {
    @State private var viewModel: PlannedWorkoutViewModel

    init(viewModel: @autoclosure @escaping () -> PlannedWorkoutViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        PlannedWorkoutContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
            .appRefreshable { await viewModel.send(.refreshPulled)?.value }
    }
}
