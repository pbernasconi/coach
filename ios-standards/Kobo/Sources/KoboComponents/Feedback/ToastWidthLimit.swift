import KoboTokens
import SwiftUI

/// Sizes a toast to its ideal one-line width, up to `ToastWidth.maxWidth`, and centres it in the width it is given,
/// so a short message hugs its label and only a message wider than the cap wraps, between words.
///
/// The layout reports the whole proposed width, not the toast's: a stack that hugs its content proposes its own width
/// on the next pass, and a layout that hugged too would measure the cap from the toast itself and shrink it to the
/// floor, breaking the label inside a word.
struct ToastWidthLimit: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        guard let toast = subviews.first else { return .zero }
        let size = toast.sizeThatFits(toastProposal(for: toast, proposedWidth: proposal.width))
        guard let width = proposal.width, width.isFinite else { return size }
        return CGSize(width: max(width, size.width), height: size.height)
    }

    func placeSubviews(in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        guard let toast = subviews.first else { return }
        toast.place(
            at: CGPoint(x: bounds.midX, y: bounds.midY),
            anchor: .center,
            proposal: toastProposal(for: toast, proposedWidth: bounds.width)
        )
    }

    private func toastProposal(for toast: LayoutSubview, proposedWidth: CGFloat?) -> ProposedViewSize {
        let ideal = toast.sizeThatFits(.unspecified).width
        return ProposedViewSize(width: ToastWidth.width(idealWidth: ideal, proposedWidth: proposedWidth), height: nil)
    }
}
