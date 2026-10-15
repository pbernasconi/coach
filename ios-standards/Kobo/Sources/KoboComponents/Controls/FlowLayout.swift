import KoboTokens
import SwiftUI

/// A wrapping layout: subviews fill a line at their ideal width, then wrap to the next line. A subview wider than the
/// line gets a line of its own and is measured again at the line width, so it wraps or truncates instead of clipping.
///
///     FlowLayout(spacing: Space.sm, lineSpacing: Space.sm) { ForEach(tags) { KoboTag($0.title) } }
public struct FlowLayout: Layout {
    private let spacing: CGFloat
    private let lineSpacing: CGFloat

    public init(spacing: CGFloat = Space.sm, lineSpacing: CGFloat = Space.sm) {
        self.spacing = spacing
        self.lineSpacing = lineSpacing
    }

    public func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let ideal = subviews.map { $0.sizeThatFits(.unspecified) }
        let maxWidth =
            proposal.width ?? FlowLines.width(of: Array(ideal.indices), widths: ideal.map(\.width), spacing: spacing)
        let sizes = Self.fitted(ideal, subviews: subviews, maxWidth: maxWidth)
        let lines = FlowLines.lines(widths: sizes.map(\.width), maxWidth: maxWidth, spacing: spacing)
        let heights = lines.map { line in line.map { sizes[$0].height }.max() ?? 0 }
        let height = heights.reduce(0, +) + lineSpacing * CGFloat(max(lines.count - 1, 0))
        let width = lines.map { FlowLines.width(of: $0, widths: sizes.map(\.width), spacing: spacing) }.max() ?? 0
        return CGSize(width: proposal.width ?? width, height: height)
    }

    public func placeSubviews(in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        let sizes = Self.fitted(
            subviews.map { $0.sizeThatFits(.unspecified) },
            subviews: subviews,
            maxWidth: bounds.width
        )
        var y = bounds.minY
        for line in FlowLines.lines(widths: sizes.map(\.width), maxWidth: bounds.width, spacing: spacing) {
            var x = bounds.minX
            let height = line.map { sizes[$0].height }.max() ?? 0
            for index in line {
                subviews[index].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(sizes[index]))
                x += sizes[index].width + spacing
            }
            y += height + lineSpacing
        }
    }

    /// A subview wider than the line is measured again at the line width.
    private static func fitted(_ sizes: [CGSize], subviews: Subviews, maxWidth: CGFloat) -> [CGSize] {
        sizes.enumerated().map { index, size in
            guard size.width > maxWidth else { return size }
            let height = subviews[index].sizeThatFits(ProposedViewSize(width: maxWidth, height: nil)).height
            return CGSize(width: maxWidth, height: height)
        }
    }
}

#if DEBUG
    private struct FlowLayoutGallery: View {
        @Environment(\.koboTheme) private var theme

        var body: some View {
            FlowLayout {
                KoboTag("Legs", tone: .accent)
                KoboTag("Hypertrophy", tone: .info, systemImage: "chart.bar")
                KoboTag("Deload week", tone: .warning, systemImage: "exclamationmark.triangle")
                KoboTag("PR", tone: .success, systemImage: "trophy")
                KoboTag("Skipped", tone: .danger, systemImage: "xmark")
                KoboTag("Bodyweight")
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Flow layout") { FlowLayoutGallery() }
    #Preview("Flow layout · dark") { FlowLayoutGallery().preferredColorScheme(.dark) }
    #Preview("Flow layout · AX3") { FlowLayoutGallery().dynamicTypeSize(.accessibility3) }
#endif
