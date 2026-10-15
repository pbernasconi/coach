import SwiftUI

/// Owns the ViewModel; renders Content; opens links (SCR-2, SCR-4).
struct AcknowledgementsScreen: View {
    @State private var viewModel: AcknowledgementsViewModel
    @Environment(\.openURL) private var openURL

    init(viewModel: @autoclosure @escaping () -> AcknowledgementsViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        AcknowledgementsContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
            .onChange(of: viewModel.state.link) { _, link in
                if let link { openURL(link.url) }
            }
    }
}
