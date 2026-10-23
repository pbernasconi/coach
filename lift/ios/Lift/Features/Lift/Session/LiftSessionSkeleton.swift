import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// The session page while it loads, in `LiftSessionSections`' layout: the title block over the card of six small
/// numbers, then the exercises card with a ghost row per exercise.
struct LiftSessionSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            VStack(alignment: .leading, spacing: Space.lg) {
                SkeletonHeader()
                SkeletonStatGrid(count: 6, columns: 3, valueRole: .headline).koboCard()
            }
            VStack(alignment: .leading, spacing: Space.sm) {
                SkeletonSectionTitle()
                ListRowSkeleton(rows: 4)
                    .padding(.vertical, Space.xs)
                    .koboCard(padding: 0)
            }
        }
        .skeletonPage()
    }
}

#if DEBUG
    private struct LiftSessionSkeletonPreview: View {
        var body: some View {
            ScrollView { LiftSessionSkeleton().pageColumn().padding(.top, Space.sm) }
                .screenCanvas()
                .koboTheme(.lift)
        }
    }

    #Preview("Session skeleton") { LiftSessionSkeletonPreview() }
    #Preview("Session skeleton, dark") { LiftSessionSkeletonPreview().preferredColorScheme(.dark) }
    #Preview("Session skeleton, AX3") { LiftSessionSkeletonPreview().dynamicTypeSize(.accessibility3) }
#endif
