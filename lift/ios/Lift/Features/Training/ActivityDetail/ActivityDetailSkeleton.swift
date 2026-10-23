import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// The activity page while it loads, in `ActivitySections`' layout: the title block, the card of six headline numbers,
/// then two chart cards.
struct ActivityDetailSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            SkeletonHeader(detailLines: 1)
            SkeletonStatGrid(count: 6).koboCard()
            VStack(alignment: .leading, spacing: Space.md) {
                SkeletonCard(lines: 0, blockHeight: AppSkeletonMetrics.chartHeight)
                SkeletonCard(lines: 0, blockHeight: AppSkeletonMetrics.chartHeight)
            }
        }
        .skeletonPage()
    }
}

#if DEBUG
    private struct ActivityDetailSkeletonPreview: View {
        var body: some View {
            ScrollView { ActivityDetailSkeleton().pageColumn().padding(.top, Space.sm) }
                .screenCanvas()
                .koboTheme(.lift)
        }
    }

    #Preview("Activity skeleton") { ActivityDetailSkeletonPreview() }
    #Preview("Activity skeleton, dark") { ActivityDetailSkeletonPreview().preferredColorScheme(.dark) }
    #Preview("Activity skeleton, AX3") { ActivityDetailSkeletonPreview().dynamicTypeSize(.accessibility3) }
#endif
