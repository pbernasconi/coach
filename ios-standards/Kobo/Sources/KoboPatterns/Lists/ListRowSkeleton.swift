import KoboComponents
import KoboTokens
import SwiftUI

/// Ghost rows in the geometry of a `ListRow`: an optional leading circle and two bars, with hairlines between rows, so
/// the content paints into its place. Put it inside a `ListSection` (as `LoadableSection` does). The rows breathe, and
/// stay still with Reduce Motion. Hidden from VoiceOver: label the container ("Loading").
///
///     ListSection { ListRowSkeleton(rows: 3) }
///         .accessibilityElement(children: .ignore)
///         .accessibilityLabel("Loading")
public struct ListRowSkeleton: View {
    @ScaledMetric(relativeTo: .body) private var leadingSide = Size.iconLg
    private let rows: Int
    private let showsLeading: Bool

    /// - Parameters:
    ///   - rows: how many ghost rows to draw.
    ///   - showsLeading: draws the leading circle, for rows with an icon or avatar.
    public init(rows: Int = 3, showsLeading: Bool = true) {
        self.rows = max(rows, 0)
        self.showsLeading = showsLeading
    }

    public var body: some View {
        VStack(spacing: 0) {
            ForEach(SkeletonSlot.slots(rows)) { slot in
                VStack(spacing: 0) {
                    if slot.id > 0 { Separator(leadingInset: separatorInset) }
                    row(slot.id)
                }
            }
        }
        .skeletonBreath()
        .accessibilityHidden(true)
    }

    private var separatorInset: CGFloat { Space.lg + (showsLeading ? leadingSide + Space.md : 0) }

    private func row(_ index: Int) -> some View {
        HStack(spacing: Space.md) {
            if showsLeading {
                Skeleton(.circle).frame(width: leadingSide, height: leadingSide)
            }
            VStack(alignment: .leading, spacing: Space.sm) {
                Skeleton(.line).frame(width: SkeletonSlot.titleWidth(index))
                Skeleton(.line).frame(width: Size.minTouch * 2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, Space.lg)
        .padding(.vertical, Space.rowVertical)
        .frame(minHeight: Size.rowMinHeight)
    }
}

/// One ghost row or bar, with a stable integer identity.
struct SkeletonSlot: Identifiable {
    let id: Int

    static func slots(_ count: Int) -> [SkeletonSlot] {
        (0..<max(count, 0)).map(SkeletonSlot.init)
    }

    /// Title widths cycle through three lengths, so the ghost rows do not read as one repeated shape.
    static func titleWidth(_ index: Int) -> CGFloat {
        let steps: [CGFloat] = [4, 3, 3.5]
        return Size.minTouch * steps[index % steps.count]
    }
}

#if DEBUG
    private struct ListRowSkeletonPreview: View {
        var body: some View {
            VStack(spacing: Space.xxl) {
                ListSection("Loading") { ListRowSkeleton(rows: 3) }
                ListSection { ListRowSkeleton(rows: 2, showsLeading: false) }
            }
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("List row skeleton") { ListRowSkeletonPreview() }
    #Preview("List row skeleton · dark, Lift") {
        ListRowSkeletonPreview().koboTheme(.lift).preferredColorScheme(.dark)
    }
    #Preview("List row skeleton · AX3") { ListRowSkeletonPreview().dynamicTypeSize(.accessibility3) }
#endif
