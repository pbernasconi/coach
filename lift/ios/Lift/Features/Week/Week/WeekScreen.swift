import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4).
struct WeekScreen: View {
    @State private var viewModel: WeekViewModel

    init(viewModel: @autoclosure @escaping () -> WeekViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        WeekContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
    }
}
