import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// The Today page while it loads, in `TodaySections`' layout: the date over the readiness chips, today's plan rows, the
/// fitness chart, then the last four weeks' tiles.
struct TodaySkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            VStack(alignment: .leading, spacing: Space.md) {
                Skeleton(.line, textRole: .headline).frame(maxWidth: Size.minTouch * 4)
                HStack(spacing: Space.sm) {
                    ForEach(0..<3) { _ in
                        Skeleton(.block).frame(width: Size.minTouch * 2.5, height: Size.minTouch)
                    }
                }
            }
            SkeletonListSection(rows: 2)
            SkeletonCard(title: .above, lines: 0, blockHeight: AppSkeletonMetrics.tallChartHeight)
            VStack(alignment: .leading, spacing: Space.sm) {
                SkeletonSectionTitle()
                SkeletonStatGrid(count: 4, style: .tiles)
            }
        }
        .skeletonPage()
    }
}

#if DEBUG
    private struct TodaySkeletonPreview: View {
        var body: some View {
            ScrollView { TodaySkeleton().pageColumn().padding(.top, Space.sm) }
                .screenCanvas()
                .koboTheme(.lift)
        }
    }

    #Preview("Today skeleton") { TodaySkeletonPreview() }
    #Preview("Today skeleton, dark") { TodaySkeletonPreview().preferredColorScheme(.dark) }
    #Preview("Today skeleton, AX3") { TodaySkeletonPreview().dynamicTypeSize(.accessibility3) }
#endif
