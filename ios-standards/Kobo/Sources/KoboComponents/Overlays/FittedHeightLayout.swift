import KoboTokens
import SwiftUI

/// Sizes its one child to the child's ideal height, capped by the offered height. Around a `ScrollView` it makes the
/// scroll view only as tall as its content, so a fitted sheet's footer sits right under short content, and long
/// content still scrolls inside the space the sheet has.
struct FittedHeightLayout: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        guard let child = subviews.first else { return .zero }
        let ideal = child.sizeThatFits(ProposedViewSize(width: proposal.width, height: nil))
        let height = SheetSizing.fittedHeight(ideal: ideal.height, offered: proposal.height)
        return CGSize(width: proposal.width ?? ideal.width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        subviews.first?.place(
            at: bounds.origin,
            anchor: .topLeading,
            proposal: ProposedViewSize(width: bounds.width, height: bounds.height)
        )
    }
}

extension View {
    /// Reports this view's laid-out height on first layout and on every change, for a fitted sheet's detent.
    func overlayReportsHeight(_ action: @escaping (CGFloat) -> Void) -> some View {
        onGeometryChange(for: CGFloat.self) { proxy in
            proxy.size.height
        } action: { height in
            action(height)
        }
    }
}

#if DEBUG
    private struct FittedHeightLayoutPreviewRow: Identifiable {
        let id: Int
    }

    private struct FittedHeightLayoutPreview: View {
        @Environment(\.koboTheme) private var theme
        let rows: [FittedHeightLayoutPreviewRow]

        init(rows: Int) {
            self.rows = (1...rows).map(FittedHeightLayoutPreviewRow.init)
        }

        var body: some View {
            VStack(spacing: 0) {
                FittedHeightLayout {
                    ScrollView {
                        VStack(alignment: .leading, spacing: Space.sm) {
                            ForEach(rows) { row in
                                Text(verbatim: "Row \(row.id)")
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(Space.gutter)
                    }
                }
                .background(theme.palette.surface)
                Text(verbatim: "Sits right under the content")
                    .padding(Space.gutter)
            }
            .frame(maxHeight: .infinity, alignment: .top)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Short") { FittedHeightLayoutPreview(rows: 3) }
    #Preview("Long, dark") { FittedHeightLayoutPreview(rows: 60).preferredColorScheme(.dark) }
    #Preview("AX3") { FittedHeightLayoutPreview(rows: 5).dynamicTypeSize(.accessibility3) }
#endif
