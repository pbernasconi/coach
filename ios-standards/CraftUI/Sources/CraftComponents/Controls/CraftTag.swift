import CraftTokens
import SwiftUI

/// A static, tonal label: a status, a category, a count. It always shows text (and optionally a symbol), so its
/// meaning never rests on colour alone. It is never a tap target; use `Chip` for that.
///
///     CraftTag("PR", tone: .success, systemImage: "trophy")
public struct CraftTag: View {
    @Environment(\.craftTheme) private var theme
    private let title: Text
    private let tone: Tone
    private let systemImage: String?

    /// A tag with a localized title.
    public init(_ titleKey: LocalizedStringKey, tone: Tone = .neutral, systemImage: String? = nil) {
        self.title = Text(titleKey)
        self.tone = tone
        self.systemImage = systemImage
    }

    /// A tag whose title is shown as is (user data, numbers).
    public init(verbatim title: String, tone: Tone = .neutral, systemImage: String? = nil) {
        self.title = Text(verbatim: title)
        self.tone = tone
        self.systemImage = systemImage
    }

    public var body: some View {
        let colors = theme.palette.status(tone)
        HStack(spacing: Space.xs) {
            if let systemImage {
                Image(systemName: systemImage).imageScale(.small).accessibilityHidden(true)
            }
            title.lineLimit(1)
        }
        .font(theme.font(.caption).weight(.semibold))
        .foregroundStyle(colors.ink)
        .padding(.horizontal, Space.sm)
        .padding(.vertical, Space.xxs)
        .background(colors.soft, in: Capsule())
        .accessibilityElement(children: .combine)
    }
}

#if DEBUG
    private struct TagGallery: View {
        @Environment(\.craftTheme) private var theme

        var body: some View {
            VStack(alignment: .leading, spacing: Space.sm) {
                HStack(spacing: Space.sm) {
                    CraftTag("Neutral")
                    CraftTag("Accent", tone: .accent)
                    CraftTag("Info", tone: .info, systemImage: "info.circle")
                }
                HStack(spacing: Space.sm) {
                    CraftTag("PR", tone: .success, systemImage: "trophy")
                    CraftTag("Deload", tone: .warning, systemImage: "exclamationmark.triangle")
                    CraftTag("Missed", tone: .danger, systemImage: "xmark")
                    CraftTag(verbatim: "3 × 8")
                }
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Tag") { TagGallery() }
    #Preview("Tag · dark, Lift") { TagGallery().craftTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Tag · AX3") { TagGallery().dynamicTypeSize(.accessibility3) }
#endif
