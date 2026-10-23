import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// The activity list while it loads: ghost rows with the sport's round badge, as `ActivityRow`s in their
/// `ListSection`.
struct ActivityListSkeleton: View {
    var body: some View {
        ListSection { ListRowSkeleton(rows: 8) }
            .skeletonPage()
    }
}

#if DEBUG
    private struct ActivityListSkeletonPreview: View {
        var body: some View {
            ScrollView { ActivityListSkeleton().pageColumn().padding(.top, Space.sm) }
                .screenCanvas()
                .koboTheme(.lift)
        }
    }

    #Preview("Activity list skeleton") { ActivityListSkeletonPreview() }
    #Preview("Activity list skeleton, dark") { ActivityListSkeletonPreview().preferredColorScheme(.dark) }
    #Preview("Activity list skeleton, AX3") { ActivityListSkeletonPreview().dynamicTypeSize(.accessibility3) }
#endif
