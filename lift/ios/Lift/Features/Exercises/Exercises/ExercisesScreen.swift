import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4).
struct ExercisesScreen: View {
    @State private var viewModel: ExercisesViewModel

    init(viewModel: @autoclosure @escaping () -> ExercisesViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        ExercisesContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
    }
}
