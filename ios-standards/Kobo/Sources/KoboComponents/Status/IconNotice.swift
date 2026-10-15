import KoboTokens
import SwiftUI

/// A static notice that explains the state of a page: a glyph in a surface disc, a semibold title over a short message,
/// on the tone's soft fill. It asks for no choice and is not pressable. The glyph and the words carry the meaning, so
/// the tone is never colour alone. VoiceOver reads one element: "title, message".
///
///     IconNotice(systemImage: "pause.circle", tone: .info, title: "Plan paused", message: "Resume it any time.")
public struct IconNotice: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var discSize = Size.minTouch
    private let systemImage: String
    private let tone: Tone
    private let title: Text
    private let message: Text?

    public init(
        systemImage: String,
        tone: Tone = .neutral,
        title: LocalizedStringKey,
        message: LocalizedStringKey? = nil
    ) {
        self.systemImage = systemImage
        self.tone = tone
        self.title = Text(title)
        self.message = message.map { Text($0) }
    }

    /// A notice whose title and message are shown as is.
    public init(systemImage: String, tone: Tone = .neutral, verbatim title: String, message: String? = nil) {
        self.systemImage = systemImage
        self.tone = tone
        self.title = Text(verbatim: title)
        self.message = message.map { Text(verbatim: $0) }
    }

    public var body: some View {
        let colors = theme.palette.status(tone)
        HStack(alignment: .top, spacing: Space.md) {
            Image(systemName: systemImage)
                .font(theme.font(.body).weight(.semibold))
                .foregroundStyle(colors.ink)
                .frame(width: discSize, height: discSize)
                .background(theme.palette.surface, in: Circle())
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Space.xs) {
                title
                    .font(theme.font(.subheadline).weight(.semibold))
                    .foregroundStyle(theme.palette.textPrimary)
                if let message {
                    message
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Space.lg)
        .background(colors.soft, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

#if DEBUG
    private struct IconNoticePreview: View {
        var body: some View {
            VStack(spacing: Space.lg) {
                IconNotice(
                    systemImage: "pause.circle",
                    tone: .info,
                    title: "Plan paused",
                    message: "Resume it any time."
                )
                IconNotice(
                    systemImage: "lock",
                    tone: .warning,
                    title: "Editing is locked",
                    message: "This week is in the past."
                )
                IconNotice(systemImage: "doc.text", title: "Summary ready")
            }
            .padding(Space.gutter)
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("Icon notice") { IconNoticePreview() }
    #Preview("Icon notice · dark, Lift") { IconNoticePreview().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Icon notice · AX3") { IconNoticePreview().dynamicTypeSize(.accessibility3) }
#endif
