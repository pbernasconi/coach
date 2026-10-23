import KoboComponents
import SwiftUI
import UIKit

/// Owns the ViewModel; renders Content; starts reads (SCR-2, SCR-4). Runs the rest countdown for each new rest and
/// shows the ViewModel's toasts through the tab's Kobo `ToastCenter`, whose Undo action goes back through `send`. The
/// tab owns the center, so "Workout discarded" and its Undo stay up after the page closes. While the workout runs the
/// screen stays awake, when Workout settings say so.
struct WorkoutScreen: View {
    @State private var viewModel: WorkoutViewModel
    private let toasts: ToastCenter

    init(viewModel: @autoclosure @escaping () -> WorkoutViewModel, toasts: ToastCenter) {
        _viewModel = State(wrappedValue: viewModel())
        self.toasts = toasts
    }

    var body: some View {
        WorkoutContent(state: viewModel.state, send: { viewModel.send($0) })
            .task { await viewModel.run() }
            .task(id: viewModel.state.rest?.run) { await viewModel.runRestTimer() }
            .onChange(of: viewModel.state.toast) { _, toast in show(toast) }
            .onChange(of: viewModel.state.keepsScreenAwake, initial: true) { _, awake in
                UIApplication.shared.isIdleTimerDisabled = awake
            }
            .onDisappear { UIApplication.shared.isIdleTimerDisabled = false }
    }

    private func show(_ toast: WorkoutToast?) {
        guard let toast else { return }
        switch toast.kind {
        case .removed(let setID):
            let viewModel = viewModel
            let undo = Toast.Action("Undo") { viewModel.send(.removeUndoTapped(setID)) }
            toasts.show(Toast("Set removed", action: undo))
        case .exerciseRemoved(let id):
            let viewModel = viewModel
            let undo = Toast.Action("Undo") { viewModel.send(.exerciseRemoveUndoTapped(id)) }
            toasts.show(Toast("Exercise removed", action: undo))
        case .discarded(let change):
            let viewModel = viewModel
            let undo = Toast.Action("Undo") { viewModel.send(.discardUndoTapped(change)) }
            toasts.show(Toast("Workout discarded", action: undo))
            viewModel.send(.discardedToastShown)
        case .savedAsTemplate(let name):
            toasts.show(Toast(verbatim: String(localized: "Saved as template \(name)")))
        case .plannedLater:
            // The header already names the day; the toast keeps to two lines between the bar buttons.
            toasts.show(Toast("Tap Start workout to log sets"))
        case .failed:
            toasts.show(Toast("Could not save. Try again.", tone: .danger))
        }
    }
}
