import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// The Today page while it loads, in `TodaySections`' layout: the fitness card with its chart, today's workouts, the
/// vitals tiles, then the trends card.
struct TodaySkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            SkeletonCard(title: .none, lines: 1, blockHeight: AppSkeletonMetrics.tallChartHeight)
            SkeletonListSection(rows: 2)
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
