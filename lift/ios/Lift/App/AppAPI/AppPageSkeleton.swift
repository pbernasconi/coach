import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// The loading state of a coach page without its own skeleton: three titled cards (text, a chart, text) in the page's
/// section rhythm. A page with a known layout passes its own skeleton to `AppResourcePage` instead.
struct AppPageSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Space.section) {
            SkeletonCard(title: .above, lines: 2)
            SkeletonCard(title: .above, lines: 0, blockHeight: AppSkeletonMetrics.chartHeight)
            SkeletonCard(title: .above, lines: 3)
        }
        .skeletonPage()
    }
}

/// The ghost of a section title (`SectionHeader`, `AppSectionView`'s title), above a skeleton list or card.
struct SkeletonSectionTitle: View {
    var body: some View {
        Skeleton(.line, textRole: .headline).frame(maxWidth: Size.minTouch * 3)
    }
}

/// A titled ghost list: the section title, then `rows` ghost rows in a flat `ListSection`, as `AppSectionView` over a
/// `ListSection` shows.
struct SkeletonListSection: View {
    var rows = 3
    var showsLeading = true

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            SkeletonSectionTitle()
            ListSection { ListRowSkeleton(rows: rows, showsLeading: showsLeading) }
        }
    }
}

/// The heights the page skeletons give their ghost charts, near the real charts' heights.
nonisolated enum AppSkeletonMetrics {
    /// A small chart card (Kobo's compact chart and its axis).
    static let chartHeight = Size.thumbnail * 2
    /// A chart on its own (Kobo's regular chart).
    static let tallChartHeight = Size.thumbnail * 3
}

#if DEBUG
    private struct AppPageSkeletonPreview: View {
        var body: some View {
            ScrollView {
                VStack(alignment: .leading, spacing: Space.section) {
                    AppPageSkeleton()
                    SkeletonListSection().skeletonPage()
                }
                .pageColumn()
            }
            .screenCanvas()
            .koboTheme(.lift)
        }
    }

    #Preview("Page skeleton") { AppPageSkeletonPreview() }
    #Preview("Page skeleton, dark") { AppPageSkeletonPreview().preferredColorScheme(.dark) }
    #Preview("Page skeleton, AX3") { AppPageSkeletonPreview().dynamicTypeSize(.accessibility3) }
#endif
