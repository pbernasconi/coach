import KoboTokens
import SwiftUI

/// A placeholder shape that stands in for content while it loads. Static by itself; add `.skeletonBreath()` or
/// `.shimmering()` for motion (both hold still under Reduce Motion and `koboFreezesMotion`). Hidden from VoiceOver:
/// label the loading container instead ("Loading").
///
///     VStack(alignment: .leading) {
///         Skeleton(.line, textRole: .headline).frame(width: Size.thumbnail * 3)
///         Skeleton(.line)
///         Skeleton(.block).frame(height: Size.thumbnail)
///     }
///     .skeletonBreath()
public struct Skeleton: View {
    /// The outline of a placeholder.
    public enum Kind: Sendable, Equatable, CaseIterable {
        /// One line of text: a full line box of `textRole` (body by default), so it grows with Dynamic Type and with a
        /// custom font family exactly as the real line would, holding a capsule inset `Space.xxs` from the top and
        /// bottom. A stack of lines keeps the rhythm of the text it stands in for. As wide as offered.
        case line
        /// A card, tile or image: a rounded rectangle that fills its frame.
        case block
        /// An avatar or icon: a circle that fits its frame.
        case circle
    }

    private let kind: Kind
    private let textRole: Typography.Role
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var lineInset = Space.xxs

    /// - Parameter textRole: the type role a `.line` stands in for; ignored by the other kinds.
    public init(_ kind: Kind = .block, textRole: Typography.Role = .body) {
        self.kind = kind
        self.textRole = textRole
    }

    public var body: some View {
        shape
            .accessibilityHidden(true)
    }

    @ViewBuilder private var shape: some View {
        switch kind {
        case .line:
            // A hidden line of the role sizes the box, so the placeholder always matches the real line height.
            Text(verbatim: "X")
                .font(theme.font(textRole))
                .frame(maxWidth: .infinity)
                .hidden()
                .overlay {
                    Capsule(style: .continuous)
                        .fill(theme.palette.surfaceSunken)
                        .padding(.vertical, lineInset)
                }
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
                Skeleton(.line, textRole: .headline).frame(width: Size.thumbnail * 3)
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
