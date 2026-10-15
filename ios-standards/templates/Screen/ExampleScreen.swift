import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4).
struct ExampleScreen: View {
    @State private var viewModel: ExampleViewModel

    init(viewModel: @autoclosure @escaping () -> ExampleViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        ExampleContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
    }
}
