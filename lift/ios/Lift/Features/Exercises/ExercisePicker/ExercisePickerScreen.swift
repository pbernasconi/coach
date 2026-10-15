import KoboComponents
import SwiftUI

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4). A failed add shows a toast.
struct ExercisePickerScreen: View {
    @State private var viewModel: ExercisePickerViewModel
    @State private var toasts = ToastCenter()

    init(viewModel: @autoclosure @escaping () -> ExercisePickerViewModel) {
        _viewModel = State(wrappedValue: viewModel())
    }

    var body: some View {
        ExercisePickerContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
            .onChange(of: viewModel.state.failures) { _, _ in
                toasts.show(Toast("Could not add the exercise. Try again.", tone: .danger))
            }
            .toastHost(toasts)
    }
}
