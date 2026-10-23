import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// The activity page while it loads, in `ActivitySections`' layout: the title block, the card of six headline numbers,
/// then two chart cards.
struct ActivityDetailSkeleton: View {
    /// What the list knew: its name and when show as real text at once, above the skeleton.
    var seed: ActivitySeed?

    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            if let seed {
                WorkoutHeader(
                    sport: seed.sport,
                    kicker: [seed.typeText, seed.startText].joined(separator: " · "),
                    title: seed.name,
                    status: nil,
                    statusLabel: ""
                )
            }
            VStack(alignment: .leading, spacing: Space.section) {
                if seed == nil { SkeletonHeader(detailLines: 1) }
                SkeletonStatGrid(count: 6).koboCard()
                VStack(alignment: .leading, spacing: Space.md) {
                    SkeletonCard(lines: 0, blockHeight: AppSkeletonMetrics.chartHeight)
                    SkeletonCard(lines: 0, blockHeight: AppSkeletonMetrics.chartHeight)
                }
            }
            // Under the list's name the skeleton shows at once: the page's layout is already there.
            .skeletonPage(waits: seed == nil)
        }
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
