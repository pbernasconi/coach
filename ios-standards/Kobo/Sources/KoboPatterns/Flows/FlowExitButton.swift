import KoboComponents
import KoboTokens
import SwiftUI

/// The toolbar ✕ of a flow step: a `HeaderButton` (the system draws the glass circle), and the leave confirmation
/// while the flow has unsaved progress.
struct FlowExitButton: View {
    @State private var isConfirming = false
    let exit: FlowExitAction

    var body: some View {
        button
            .confirmationDialog(exit.confirmTitle, isPresented: $isConfirming, titleVisibility: .visible) {
                Button(role: .destructive, action: exit.action) { exit.confirmLabel }
                Button(role: .cancel) {
                } label: {
                    Text("Keep going", bundle: .module)
                }
            } message: {
                if let message = exit.confirmMessage { message }
            }
    }

    @ViewBuilder private var button: some View {
        if let label = exit.accessibilityLabel {
            HeaderButton(systemImage: "xmark", accessibilityLabel: label, action: tap)
                .keyboardShortcut(.cancelAction)
        } else {
            HeaderButton(.close, action: tap)
        }
    }

    private func tap() {
        switch FlowExitDecision.onTap(hasUnsavedProgress: exit.hasUnsavedProgress) {
        case .leave: exit.action()
        case .confirm: isConfirming = true
        }
    }
}
