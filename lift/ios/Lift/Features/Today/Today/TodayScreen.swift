import KoboComponents
import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4).
struct TodayScreen: View {
    @State private var viewModel: TodayViewModel

    init(viewModel: @autoclosure @escaping () -> TodayViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        TodayContent(state: viewModel.state, send: { viewModel.send($0) })
            .appRefreshable { await viewModel.send(.refreshPulled)?.value }
            .task { await viewModel.run() }
    }
}
