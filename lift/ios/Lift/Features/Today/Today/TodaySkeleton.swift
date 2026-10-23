import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// The Today page while it loads, in `TodaySections`' layout: the date and Garmin lines, today's plan rows, the
/// readiness card, the vitals tiles, then the trends card.
struct TodaySkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            VStack(alignment: .leading, spacing: Space.xs) {
                Skeleton(.line, textRole: .headline).frame(maxWidth: Size.minTouch * 4)
                Skeleton(.line, textRole: .footnote).frame(maxWidth: Size.minTouch * 6)
            }
            SkeletonListSection(rows: 2)
            SkeletonCard(title: .above, lines: 2)
            VStack(alignment: .leading, spacing: Space.sm) {
                SkeletonSectionTitle()
                SkeletonStatGrid(count: 4, style: .tiles)
            }
            SkeletonCard(title: .above, lines: 0, blockHeight: AppSkeletonMetrics.tallChartHeight)
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
