import KoboComponents
import KoboTokens
import SwiftUI

/// Ghost lines in the geometry of a page's title block: a small line over the title (what and when), the title, then
/// `detailLines` quiet lines under it (a place, a note). Each line is a full line box of its type role, so it grows with
/// Dynamic Type as the real text does. Put it in a `.skeletonPage()` stack, which breathes and labels it.
///
///     VStack(alignment: .leading, spacing: Space.section) {
///         SkeletonHeader(detailLines: 1)
///         SkeletonCard(lines: 2)
///     }
///     .skeletonPage()
public struct SkeletonHeader: View {
    private let showsKicker: Bool
    private let detailLines: Int

    /// - Parameters:
    ///   - showsKicker: draws the small line above the title.
    ///   - detailLines: how many quiet lines to draw under the title.
    public init(showsKicker: Bool = true, detailLines: Int = 0) {
        self.showsKicker = showsKicker
        self.detailLines = max(detailLines, 0)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            if showsKicker {
                Skeleton(.line, textRole: .subheadline).frame(maxWidth: Size.minTouch * 5)
            }
            Skeleton(.line, textRole: .title).frame(maxWidth: Size.minTouch * 6)
            ForEach(SkeletonSlot.slots(detailLines)) { slot in
                Skeleton(.line, textRole: .subheadline)
                    .frame(maxWidth: SkeletonLayout.shortLineWidth(slot.id) * 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityHidden(true)
    }
}

#if DEBUG
    private struct SkeletonHeaderPreview: View {
        var body: some View {
            VStack(alignment: .leading, spacing: Space.section) {
                SkeletonHeader()
                SkeletonHeader(showsKicker: false, detailLines: 2)
            }
            .skeletonPage()
            .pageGutter()
        }
    }

    #Preview("Skeleton header") { SkeletonHeaderPreview() }
    #Preview("Skeleton header, dark") { SkeletonHeaderPreview().preferredColorScheme(.dark) }
    #Preview("Skeleton header, AX3") { SkeletonHeaderPreview().dynamicTypeSize(.accessibility3) }
#endif
