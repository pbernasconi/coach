import KoboTokens
import SwiftUI

/// A placeholder shape that stands in for content while it loads. Static by itself; add `.skeletonBreath()` or
/// `.shimmering()` for motion. Hidden from VoiceOver: label the loading container instead.
///
///     VStack(alignment: .leading) {
///         Skeleton(.line).frame(width: 160)
///         Skeleton(.block).frame(height: 80)
///     }
///     .skeletonBreath()
public struct Skeleton: View {
    /// The outline of a placeholder.
    public enum Kind: Sendable, Equatable, CaseIterable {
        /// One line of text: a capsule as tall as a line of body text, as wide as offered.
        case line
        /// A card, tile or image: a rounded rectangle that fills its frame.
        case block
        /// An avatar or icon: a circle that fits its frame.
        case circle
    }

    private let kind: Kind
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var lineHeight = Space.md

    public init(_ kind: Kind = .block) {
        self.kind = kind
    }

    public var body: some View {
        shape
            .accessibilityHidden(true)
    }

    @ViewBuilder private var shape: some View {
        switch kind {
        case .line:
            Capsule(style: .continuous)
                .fill(theme.palette.surfaceSunken)
                .frame(maxWidth: .infinity)
                .frame(height: lineHeight)
        case .block:
            RoundedRectangle(cornerRadius: Radius.sm, style: .continuous)
                .fill(theme.palette.surfaceSunken)
        case .circle:
            Circle()
                .fill(theme.palette.surfaceSunken)
                .aspectRatio(1, contentMode: .fit)
        }
    }
}

private struct SkeletonPreviewRow: View {
    var body: some View {
        HStack(alignment: .top, spacing: Space.md) {
            Skeleton(.circle).frame(width: Size.thumbnail, height: Size.thumbnail)
            VStack(alignment: .leading, spacing: Space.sm) {
                Skeleton(.line).frame(width: Size.thumbnail * 3)
                Skeleton(.line)
                Skeleton(.block).frame(height: Size.thumbnail)
            }
        }
        .padding()
    }
}

#Preview("Skeleton") {
    VStack(spacing: Space.xl) {
        SkeletonPreviewRow().skeletonBreath()
        SkeletonPreviewRow().shimmering()
        Text("Redacted text shimmers too").redacted(reason: .placeholder).shimmering()
    }
}

#Preview("Skeleton, dark") {
    SkeletonPreviewRow().shimmering().preferredColorScheme(.dark)
}

#Preview("Skeleton, AX3") {
    SkeletonPreviewRow().skeletonBreath().dynamicTypeSize(.accessibility3)
}
