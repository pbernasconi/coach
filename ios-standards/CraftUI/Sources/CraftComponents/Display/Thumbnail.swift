import CraftTokens
import SwiftUI

/// A rounded square tile that shows an SF Symbol, an image or any custom content on a tone's soft fill, with an
/// optional corner badge (a play glyph on a video, a check on a done item). Decorative unless given a label.
///
///     Thumbnail(systemName: "figure.strengthtraining.traditional", tone: .accent) {
///         ThumbnailBadge(systemName: "play.fill")
///     }
public struct Thumbnail<Content: View, Badge: View>: View {
    private let tone: Tone
    private let side: CGFloat
    private let fillsTile: Bool
    private let label: String?
    private let content: Content
    private let badge: Badge
    @Environment(\.craftTheme) private var theme

    /// A tile with custom content (inherits the tone's ink as its foreground) and a corner badge.
    public init(
        tone: Tone = .neutral,
        side: CGFloat = Size.thumbnail,
        accessibilityLabel: String? = nil,
        @ViewBuilder content: () -> Content,
        @ViewBuilder badge: () -> Badge
    ) {
        self.init(
            tone: tone,
            side: side,
            fillsTile: false,
            label: accessibilityLabel,
            content: content(),
            badge: badge()
        )
    }

    fileprivate init(tone: Tone, side: CGFloat, fillsTile: Bool, label: String?, content: Content, badge: Badge) {
        self.tone = tone
        self.side = side
        self.fillsTile = fillsTile
        self.label = label
        self.content = content
        self.badge = badge
    }

    public var body: some View {
        let colors = theme.palette.status(tone)
        ZStack {
            colors.soft
            if fillsTile {
                content.scaledToFill()
            } else {
                content
                    // Maths inside the tile: the glyph keeps its proportion at every tile size.
                    .font(.system(size: side * 0.42, weight: .semibold))
                    .foregroundStyle(colors.ink)
            }
        }
        .frame(width: side, height: side)
        .clipShape(RoundedRectangle(cornerRadius: Self.cornerRadius(side: side), style: .continuous))
        .overlay(alignment: .bottomTrailing) {
            badge.padding(Space.xs)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label.map { Text($0) } ?? Text(verbatim: ""))
        .accessibilityAddTraits(.isImage)
        .accessibilityHidden(label == nil)
    }

    /// `Radius.md` at the standard size, scaled down for smaller tiles so they never turn into circles.
    static func cornerRadius(side: CGFloat) -> CGFloat {
        min(Radius.md, side * Radius.md / Size.thumbnail)
    }
}

extension Thumbnail where Badge == EmptyView {
    /// A tile with custom content and no badge.
    public init(
        tone: Tone = .neutral,
        side: CGFloat = Size.thumbnail,
        accessibilityLabel: String? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.init(tone: tone, side: side, accessibilityLabel: accessibilityLabel, content: content) { EmptyView() }
    }
}

extension Thumbnail where Content == Image {
    /// A tile showing an SF Symbol in the tone's ink, with a corner badge.
    public init(
        systemName: String,
        tone: Tone = .neutral,
        side: CGFloat = Size.thumbnail,
        accessibilityLabel: String? = nil,
        @ViewBuilder badge: () -> Badge
    ) {
        let glyph = Image(systemName: systemName)
        self.init(tone: tone, side: side, fillsTile: false, label: accessibilityLabel, content: glyph, badge: badge())
    }

    /// A tile showing a picture cropped to fill it, with a corner badge.
    public init(
        image: Image,
        tone: Tone = .neutral,
        side: CGFloat = Size.thumbnail,
        accessibilityLabel: String? = nil,
        @ViewBuilder badge: () -> Badge
    ) {
        let picture = image.resizable()
        self.init(tone: tone, side: side, fillsTile: true, label: accessibilityLabel, content: picture, badge: badge())
    }
}

extension Thumbnail where Content == Image, Badge == EmptyView {
    /// A tile showing an SF Symbol in the tone's ink.
    public init(
        systemName: String,
        tone: Tone = .neutral,
        side: CGFloat = Size.thumbnail,
        accessibilityLabel: String? = nil
    ) {
        self.init(systemName: systemName, tone: tone, side: side, accessibilityLabel: accessibilityLabel) {
            EmptyView()
        }
    }

    /// A tile showing a picture cropped to fill it.
    public init(image: Image, tone: Tone = .neutral, side: CGFloat = Size.thumbnail, accessibilityLabel: String? = nil)
    {
        self.init(image: image, tone: tone, side: side, accessibilityLabel: accessibilityLabel) { EmptyView() }
    }
}

private struct ThumbnailPreviews: View {
    var body: some View {
        HStack(spacing: Space.md) {
            Thumbnail(systemName: "dumbbell.fill", tone: .accent, accessibilityLabel: "Bench press, has video") {
                ThumbnailBadge(systemName: "play.fill")
            }
            Thumbnail(systemName: "figure.run", tone: .info)
            Thumbnail(systemName: "dumbbell.fill", tone: .success, side: Size.minTouch)
            Thumbnail(tone: .warning) {
                Text("A1")
            }
        }
        .padding()
    }
}

#Preview("Thumbnail") { ThumbnailPreviews().craftTheme(.lift) }
#Preview("Thumbnail, dark") { ThumbnailPreviews().craftTheme(.lift).preferredColorScheme(.dark) }
#Preview("Thumbnail, AX3") { ThumbnailPreviews().dynamicTypeSize(.accessibility3) }
