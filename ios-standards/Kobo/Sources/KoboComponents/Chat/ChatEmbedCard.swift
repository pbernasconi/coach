import KoboTokens
import SwiftUI

/// A card an assistant shows inside its reply: a glyph, a title and an optional subtitle, then any content (a chart, a
/// list, a picture). With `action`, the header is a button with a chevron that opens the thing in full; the content
/// stays free for its own controls. On a card surface; VoiceOver reads the header as one element.
///
///     ChatEmbedCard(verbatim: "Team review", subtitle: "Tue 09:00 · 45 min", systemImage: "calendar", action: open) {
///         Text("Agenda: …")
///     }
public struct ChatEmbedCard<Content: View>: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var glyph = Size.iconMd
    private let title: String
    private let subtitle: String?
    private let systemImage: String?
    private let action: (() -> Void)?
    private let content: Content

    /// A card; `action` makes the header open the full page.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        systemImage: String? = nil,
        action: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.systemImage = systemImage
        self.action = action
        self.content = content()
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            if let action {
                Button(action: action) { header(showsChevron: true) }
                    .buttonStyle(.plain)
                    .accessibilityHint(Text("Opens it in full", bundle: .module))
            } else {
                header(showsChevron: false)
            }
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .koboCard()
        .accessibilityElement(children: .contain)
    }

    private func header(showsChevron: Bool) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.system(size: glyph, weight: .semibold))
                    .foregroundStyle(theme.palette.accentText)
                    .frame(width: glyph)
                    .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: Space.xxs) {
                Text(verbatim: title)
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                if let subtitle {
                    Text(verbatim: subtitle)
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Space.sm)
            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(theme.font(.footnote).weight(.semibold))
                    .foregroundStyle(theme.palette.textTertiary)
                    .accessibilityHidden(true)
            }
        }
        .frame(minHeight: Size.minTouch)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

#if DEBUG
    private struct ChatEmbedCardPreview: View {
        var body: some View {
            VStack(spacing: Space.lg) {
                ChatEmbedCard(
                    verbatim: "Team review",
                    subtitle: "Tue 09:00 · 45 min",
                    systemImage: "calendar",
                    action: {}
                ) {
                    Text(verbatim: "Agenda: the launch plan, then questions.")
                        .font(.body)
                }
                ChatEmbedCard(verbatim: "Packing list", systemImage: "suitcase") {
                    Text(verbatim: "Passport, charger, jacket.")
                }
            }
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Embed card") { ChatEmbedCardPreview() }
    #Preview("Embed card · dark") { ChatEmbedCardPreview().preferredColorScheme(.dark) }
    #Preview("Embed card · AX3") { ChatEmbedCardPreview().dynamicTypeSize(.accessibility3) }
#endif
