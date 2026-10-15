import SwiftUI

/// Owns the ViewModel; renders Content; starts reads and opens links (SCR-2, SCR-4).
struct ExerciseDetailScreen: View {
    @State private var viewModel: ExerciseDetailViewModel
    @Environment(\.openURL) private var openURL

    init(viewModel: @autoclosure @escaping () -> ExerciseDetailViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        ExerciseDetailContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
            .task(id: viewModel.state.media) { await viewModel.loadAnimation() }
            .onChange(of: viewModel.state.link) { _, link in
                if let link { openURL(link.url) }
            }
    }
}
