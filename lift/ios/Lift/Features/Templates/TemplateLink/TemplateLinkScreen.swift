import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4).
struct TemplateLinkScreen: View {
    @State private var viewModel: TemplateLinkViewModel

    init(viewModel: @autoclosure @escaping () -> TemplateLinkViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        TemplateLinkContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
    }
}
