import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4).
struct WorkoutSummaryScreen: View {
    @State private var viewModel: WorkoutSummaryViewModel

    init(viewModel: @autoclosure @escaping () -> WorkoutSummaryViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        WorkoutSummaryContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
    }
}
