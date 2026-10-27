import SwiftUI

/// Owns the ViewModel; renders Content (SCR-2, SCR-4).
struct CoachScreen: View {
    @State private var viewModel: CoachViewModel
    @Environment(\.scenePhase) private var scenePhase

    init(viewModel: @autoclosure @escaping () -> CoachViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        CoachContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }  // again each time the tab shows
            .onAppear { viewModel.send(.shown(true)) }
            .onDisappear { viewModel.send(.shown(false)) }
            .onChange(of: scenePhase) { _, phase in
                if phase != .inactive { viewModel.send(.sceneActive(phase == .active)) }
            }
    }
}
