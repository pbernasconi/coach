import SwiftUI

/// Owns the ViewModel; renders Content (SCR-2, SCR-4).
struct CoachScreen: View {
    @State private var viewModel: CoachViewModel

    init(viewModel: @autoclosure @escaping () -> CoachViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        CoachContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
    }
}
