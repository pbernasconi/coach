import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4).
struct SettingsScreen: View {
    @State private var viewModel: SettingsViewModel

    init(viewModel: @autoclosure @escaping () -> SettingsViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        SettingsContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
            .appRefreshable { await viewModel.send(.refreshPulled)?.value }
    }
}
