import KoboComponents
import KoboTokens
import SwiftUI

/// The pinned actions of an outcome: one strong action ("Done") and an optional quiet one under it ("Start another").
/// While the outcome is pending the quiet one waits, so nothing restarts work that has not finished.
struct OutcomeFooter: View {
    let primary: OutcomeAction
    let secondary: OutcomeAction?
    let isPending: Bool

    var body: some View {
        VStack(spacing: Space.xs) {
            Button(action: primary.action) { primary.title }
                .buttonStyle(.kobo(.primary, width: .full))
            if let secondary {
                Button(action: secondary.action) { secondary.title }
                    .buttonStyle(.kobo(.plain, width: .full))
                    .disabled(isPending)
            }
        }
    }
}
