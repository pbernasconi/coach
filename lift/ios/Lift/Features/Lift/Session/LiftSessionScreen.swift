import SwiftUI

/// Owns the ViewModel; renders Content; starts the read (SCR-2, SCR-4).
struct LiftSessionScreen: View {
    @State private var viewModel: LiftSessionViewModel
    /// Shows the local workout when the coach cannot show the session and this iPhone has it.
    private let showLocal: (UUID) -> Void

    init(viewModel: @autoclosure @escaping () -> LiftSessionViewModel, showLocal: @escaping (UUID) -> Void) {
        _viewModel = State(wrappedValue: viewModel())
        self.showLocal = showLocal
    }

    var body: some View {
        LiftSessionContent(state: viewModel.state, send: { viewModel.send($0) })
            .appRefreshable { await viewModel.send(.refreshPulled)?.value }
            .task { await viewModel.run() }
            .onChange(of: viewModel.state.localFallback) { _, id in
                if let id { showLocal(id) }
            }
    }
}
