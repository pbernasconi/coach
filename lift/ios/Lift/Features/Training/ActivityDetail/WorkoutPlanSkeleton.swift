import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// The planned workout page while it loads, in `PlannedWorkoutSections`' layout: the title block with its status, the
/// card of headline numbers, the workout card with its interval chart, then the zones card.
struct PlannedWorkoutSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            SkeletonHeader(detailLines: 1)
            SkeletonStatGrid(count: 4).koboCard()
            SkeletonCard(title: .above, lines: 2, blockHeight: Space.xxxl * 3)
            SkeletonCard(title: .above, lines: 3)
        }
        .skeletonPage()
    }
}

#if DEBUG
    private struct PlannedWorkoutSkeletonPreview: View {
        var body: some View {
            ScrollView { PlannedWorkoutSkeleton().pageColumn().padding(.top, Space.sm) }
                .screenCanvas()
                .koboTheme(.lift)
        }
    }

    #Preview("Planned workout skeleton") { PlannedWorkoutSkeletonPreview() }
    #Preview("Planned workout skeleton, dark") { PlannedWorkoutSkeletonPreview().preferredColorScheme(.dark) }
    #Preview("Planned workout skeleton, AX3") { PlannedWorkoutSkeletonPreview().dynamicTypeSize(.accessibility3) }
#endif
