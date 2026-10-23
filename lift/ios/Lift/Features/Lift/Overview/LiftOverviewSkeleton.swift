import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// The Lift page while it loads, in `LiftOverviewSections`' layout: this week (the count, its bar, the seven days and
/// the stat tiles), then the main lifts card and the sessions rows.
struct LiftOverviewSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            VStack(alignment: .leading, spacing: Space.lg) {
                VStack(alignment: .leading, spacing: Space.sm) {
                    SkeletonSectionTitle()
                    Skeleton(.line, textRole: .title).frame(maxWidth: Size.minTouch * 4)
                    Skeleton(.block).frame(height: Space.sm)
                }
                HStack(spacing: Space.sm) {
                    ForEach(0..<7) { _ in Skeleton(.circle).frame(maxWidth: Size.minTouch) }
                }
                SkeletonStatGrid(count: 4, style: .tiles)
            }
            SkeletonCard(title: .above, lines: 3)
            SkeletonListSection(rows: 3)
        }
        .skeletonPage()
    }
}

#if DEBUG
    private struct LiftOverviewSkeletonPreview: View {
        var body: some View {
            ScrollView { LiftOverviewSkeleton().pageColumn().padding(.top, Space.sm) }
                .screenCanvas()
                .koboTheme(.lift)
        }
    }

    #Preview("Lift skeleton") { LiftOverviewSkeletonPreview() }
    #Preview("Lift skeleton, dark") { LiftOverviewSkeletonPreview().preferredColorScheme(.dark) }
    #Preview("Lift skeleton, AX3") { LiftOverviewSkeletonPreview().dynamicTypeSize(.accessibility3) }
#endif
