import KoboTokens
import SwiftUI

/// A static, tonal label: a status, a category, a count. It always shows text (and optionally a symbol), so its
/// meaning never rests on colour alone. It is never a tap target; use `Chip` for that.
///
///     KoboTag("New", tone: .success, systemImage: "sparkles")
///     KoboTag("Owner", style: .outline)
public struct KoboTag: View {
    /// How the tag is drawn.
    public enum Style: Sendable, Equatable, CaseIterable {
        /// The tone's soft fill with its ink: a status, a category, a promotion.
        case tonal
        /// No fill, a hairline rim and the secondary ink: a quiet role or attribute ("Owner", "Shared").
        case outline
    }

    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private let title: Text
    private let tone: Tone
    private let style: Style
    private let systemImage: String?

    /// A tag with a localized title.
    public init(
        _ titleKey: LocalizedStringKey,
        tone: Tone = .neutral,
        style: Style = .tonal,
        systemImage: String? = nil
    ) {
        self.title = Text(titleKey)
        self.tone = tone
        self.style = style
        self.systemImage = systemImage
    }

    /// A tag whose title is shown as is (user data, numbers).
    public init(verbatim title: String, tone: Tone = .neutral, style: Style = .tonal, systemImage: String? = nil) {
        self.title = Text(verbatim: title)
        self.tone = tone
        self.style = style
        self.systemImage = systemImage
    }

    public var body: some View {
        let colors = theme.palette.status(tone)
        HStack(spacing: Space.xs) {
            if let systemImage {
                Image(systemName: systemImage).imageScale(.small).accessibilityHidden(true)
            }
            // One line, two at accessibility sizes, so a long tag never truncates to a single letter.
            title.lineLimit(dynamicTypeSize.isAccessibilitySize ? 2 : 1)
        }
        .font(theme.font(.caption).weight(.semibold))
        .foregroundStyle(style == .outline ? theme.palette.textSecondary : colors.ink)
        .padding(.horizontal, Space.sm)
        .padding(.vertical, Space.xxs)
        .background(style == .outline ? Color.clear : colors.soft, in: Capsule())
        .overlay {
            if style == .outline { Capsule().strokeBorder(theme.palette.textTertiary, lineWidth: Size.hairline * 2) }
        }
        .accessibilityElement(children: .combine)
    }
}

#if DEBUG
    private struct TagGallery: View {
        @Environment(\.koboTheme) private var theme

        var body: some View {
            VStack(alignment: .leading, spacing: Space.sm) {
                HStack(spacing: Space.sm) {
                    KoboTag("Neutral")
                    KoboTag("Accent", tone: .accent)
                    KoboTag("Info", tone: .info, systemImage: "info.circle")
                }
                HStack(spacing: Space.sm) {
                    KoboTag("Done", tone: .success, systemImage: "checkmark")
                    KoboTag("Due soon", tone: .warning, systemImage: "exclamationmark.triangle")
                    KoboTag("Missed", tone: .danger, systemImage: "xmark")
                    KoboTag(verbatim: "3 × 8")
                    KoboTag("Owner", style: .outline)
                }
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Tag") { TagGallery() }
    #Preview("Tag · dark, Amber") { TagGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Tag · AX3") { TagGallery().dynamicTypeSize(.accessibility3) }
#endif
