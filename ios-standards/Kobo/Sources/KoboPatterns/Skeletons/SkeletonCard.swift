import KoboComponents
import KoboTokens
import SwiftUI

/// A ghost card: an optional title line above the card (as a `CardSection` header) or inside it at the top, then
/// `lines` lines of text, then an optional block (a chart, an image) of `blockHeight`. Put it in a `.skeletonPage()`
/// stack, which breathes and labels it.
///
///     SkeletonCard(lines: 0, blockHeight: Size.thumbnail * 2)   // a small chart card
///     SkeletonCard(title: .above, lines: 3)                     // a titled card of text
public struct SkeletonCard: View {
    /// Where the card's title line sits.
    public enum Title: Sendable, Equatable, CaseIterable {
        /// No title line.
        case none
        /// A headline line inside the card, at the top.
        case inside
        /// A headline line above the card, as a `CardSection` or `SectionHeader` title.
        case above
    }

    private let title: Title
    private let lines: Int
    private let blockHeight: CGFloat?

    /// - Parameters:
    ///   - title: where the title line sits.
    ///   - lines: how many lines of text in the card.
    ///   - blockHeight: the height of a block under the lines; none when nil.
    public init(title: Title = .inside, lines: Int = 2, blockHeight: CGFloat? = nil) {
        self.title = title
        self.lines = max(lines, 0)
        self.blockHeight = blockHeight
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            if title == .above { titleLine }
            VStack(alignment: .leading, spacing: Space.sm) {
                if title == .inside { titleLine }
                ForEach(SkeletonSlot.slots(lines)) { slot in
                    Skeleton(.line, textRole: .subheadline)
                        .frame(maxWidth: SkeletonLayout.bodyLineWidth(slot.id, of: lines) ?? .infinity)
                }
                if let blockHeight {
                    Skeleton(.block).frame(height: blockHeight)
                }
            }
            .koboCard()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityHidden(true)
    }

    private var titleLine: some View {
        Skeleton(.line, textRole: .headline).frame(maxWidth: Size.minTouch * 3)
    }
}

#if DEBUG
    private struct SkeletonCardPreview: View {
        var body: some View {
            VStack(alignment: .leading, spacing: Space.section) {
                SkeletonCard(lines: 0, blockHeight: Size.thumbnail * 2)
                SkeletonCard(title: .above, lines: 3)
                SkeletonCard(title: .none, lines: 1)
            }
            .skeletonPage()
            .pageGutter()
            .screenCanvas()
        }
    }

    #Preview("Skeleton card") { SkeletonCardPreview() }
    #Preview("Skeleton card, dark") { SkeletonCardPreview().preferredColorScheme(.dark) }
    #Preview("Skeleton card, AX3") { SkeletonCardPreview().dynamicTypeSize(.accessibility3) }
#endif
