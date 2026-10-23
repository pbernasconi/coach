import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// The Trends page while it loads, in `TrendsPage`'s layout: the performance tiles, the ramp rate rows, then the
/// peaks chart.
struct TrendsSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            VStack(alignment: .leading, spacing: Space.sm) {
                SkeletonSectionTitle()
                SkeletonStatGrid(count: 4, style: .tiles)
            }
            SkeletonListSection(rows: 2, showsLeading: false)
            SkeletonCard(title: .above, lines: 0, blockHeight: AppSkeletonMetrics.tallChartHeight)
        }
        .skeletonPage()
    }
}

#if DEBUG
    private struct TrendsSkeletonPreview: View {
        var body: some View {
            ScrollView { TrendsSkeleton().pageColumn().padding(.top, Space.sm) }
                .screenCanvas()
                .koboTheme(.lift)
        }
    }

    #Preview("Trends skeleton") { TrendsSkeletonPreview() }
    #Preview("Trends skeleton, dark") { TrendsSkeletonPreview().preferredColorScheme(.dark) }
    #Preview("Trends skeleton, AX3") { TrendsSkeletonPreview().dynamicTypeSize(.accessibility3) }
#endif
