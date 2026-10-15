import KoboTokens
import SwiftUI

/// The tinted disc with an SF Symbol at the top of an `EmptyState` or `ErrorState`. Decorative: hidden from VoiceOver,
/// because the title carries the meaning. Pass it, or your own illustration, to the `art:` slot of `EmptyState`.
///
///     EmptyState(title: "Plan your first week", message: "Pick the days you train.") {
///         EmptyStateArt(systemImage: "calendar.badge.plus", tone: .accent, scale: .large)
///     } actions: {
///         Button("Plan a week", action: plan).buttonStyle(.kobo(.primary))
///     }
public struct EmptyStateArt: View {
    /// How much room the art takes.
    public enum Scale: Sendable, Equatable, CaseIterable {
        /// A 56pt disc that grows with Dynamic Type: a section or a search with no results.
        case regular
        /// A first-run illustration: twice the regular disc, and one and a half times it at accessibility text sizes
        /// or in a short (landscape) window, where the copy needs the room.
        case large
    }

    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    #if os(iOS)
        @Environment(\.verticalSizeClass) private var verticalSizeClass
    #endif
    @ScaledMetric(relativeTo: .largeTitle) private var regularSide = Size.thumbnail
    private let systemImage: String
    private let tone: Tone
    private let scale: Scale

    public init(systemImage: String, tone: Tone = .neutral, scale: Scale = .regular) {
        self.systemImage = systemImage
        self.tone = tone
        self.scale = scale
    }

    public var body: some View {
        let colors = theme.palette.status(tone)
        Image(systemName: systemImage)
            .font(glyphFont)
            .foregroundStyle(colors.ink)
            .frame(width: side, height: side)
            .background(colors.soft, in: Circle())
            .accessibilityHidden(true)
    }

    /// The large disc has a fixed side, so its glyph scales with the disc (maths inside the shape, as `Avatar` does);
    /// the regular disc scales with Dynamic Type and its glyph with the title2 role.
    private var glyphFont: Font {
        scale == .regular ? theme.font(.title2) : .system(size: side * Self.glyphRatio, weight: .regular)
    }

    private var side: CGFloat {
        switch scale {
        case .regular: regularSide
        case .large: Self.largeSide(compact: dynamicTypeSize.isAccessibilitySize || isShortWindow)
        }
    }

    private var isShortWindow: Bool {
        #if os(iOS)
            verticalSizeClass == .compact
        #else
            false
        #endif
    }

    /// The glyph's share of the large disc.
    static let glyphRatio: CGFloat = 0.45

    /// The large disc's side: smaller when the text is huge or the window is short.
    static func largeSide(compact: Bool) -> CGFloat {
        compact ? Size.thumbnail * 1.5 : Size.thumbnail * 2
    }
}

#if DEBUG
    private struct EmptyStateArtGallery: View {
        var body: some View {
            HStack(spacing: Space.xl) {
                EmptyStateArt(systemImage: "magnifyingglass")
                EmptyStateArt(systemImage: "exclamationmark.triangle.fill", tone: .danger)
                EmptyStateArt(systemImage: "calendar.badge.plus", tone: .accent, scale: .large)
            }
            .padding(Space.gutter)
        }
    }

    #Preview("Empty state art") { EmptyStateArtGallery() }
    #Preview("Empty state art · dark, Lift") { EmptyStateArtGallery().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Empty state art · AX3") { EmptyStateArtGallery().dynamicTypeSize(.accessibility3) }
#endif
