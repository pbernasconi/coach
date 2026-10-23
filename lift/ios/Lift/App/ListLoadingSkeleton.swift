import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// The loading state of a list read from the local database: ghost rows in a flat `ListSection`, under the real title
/// when there is one. The rows stay invisible for Kobo's loading grace, so the usual fast read shows nothing, and then
/// breathe as one "Loading" element. Screens that import LiftCore use it, so they need not import KoboPatterns (whose
/// `Loadable` has the same name as LiftCore's).
struct ListLoadingSkeleton: View {
    var title: LocalizedStringKey?
    var rows = 5
    /// Draws the leading circle, for rows with an icon or a picture.
    var showsLeading = true

    var body: some View {
        ListSection(title) {
            ListRowSkeleton(rows: rows, showsLeading: showsLeading).skeletonPage()
        }
    }
}

#if DEBUG
    private struct ListLoadingSkeletonPreview: View {
        var body: some View {
            ScrollView {
                VStack(alignment: .leading, spacing: Space.section) {
                    ListLoadingSkeleton(rows: 3)
                    ListLoadingSkeleton(title: "Recent", rows: 2, showsLeading: false)
                }
                .pageColumn()
            }
            .screenCanvas()
            .koboTheme(.lift)
        }
    }

    #Preview("List skeleton") { ListLoadingSkeletonPreview() }
    #Preview("List skeleton, dark") { ListLoadingSkeletonPreview().preferredColorScheme(.dark) }
    #Preview("List skeleton, AX3") { ListLoadingSkeletonPreview().dynamicTypeSize(.accessibility3) }
#endif
