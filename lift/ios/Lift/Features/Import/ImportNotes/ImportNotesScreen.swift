import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4).
struct ImportNotesScreen: View {
    @State private var viewModel: ImportNotesViewModel

    init(viewModel: @autoclosure @escaping () -> ImportNotesViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        ImportNotesContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
    }
}
