import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4). The Week tab presents it full screen; once the
/// week is accepted, `onAccepted` closes it with the coach's line.
struct WeekPlannerScreen: View {
    @State private var viewModel: WeekPlannerViewModel
    let onAccepted: (String) -> Void

    init(viewModel: @autoclosure @escaping () -> WeekPlannerViewModel, onAccepted: @escaping (String) -> Void) {
        _viewModel = State(wrappedValue: viewModel())
        self.onAccepted = onAccepted
    }

    var body: some View {
        WeekPlannerContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
            .onChange(of: viewModel.state.acceptedNote) { _, note in
                if let note { onAccepted(note) }
            }
    }
}
