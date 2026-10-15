import KoboComponents
import KoboTokens
import SwiftUI

/// A preview section with nothing to show that keeps its card, so the layout does not jump when rows arrive: one row
/// with a muted glyph disc, a title and a caption. Not a button. VoiceOver reads it as one element.
///
///     SectionEmptyCard("No sessions yet", caption: "Logged sessions show here.", systemImage: "figure.run")
public struct SectionEmptyCard: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var discSize = Size.minTouch
    private let title: Text
    private let caption: Text?
    private let systemImage: String

    public init(_ title: LocalizedStringKey, caption: LocalizedStringKey? = nil, systemImage: String = "tray") {
        self.title = Text(title)
        self.caption = caption.map { Text($0) }
        self.systemImage = systemImage
    }

    /// A card whose title and caption are shown as is.
    public init(verbatim title: String, caption: String? = nil, systemImage: String = "tray") {
        self.title = Text(verbatim: title)
        self.caption = caption.map { Text(verbatim: $0) }
        self.systemImage = systemImage
    }

    public var body: some View {
        HStack(spacing: Space.md) {
            Image(systemName: systemImage)
                .font(theme.font(.body))
                .foregroundStyle(theme.palette.textSecondary)
                .frame(width: discSize, height: discSize)
                .background(theme.palette.surfaceSunken, in: Circle())
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Space.xxs) {
                title
                    .font(theme.font(.subheadline).weight(.semibold))
                    .foregroundStyle(theme.palette.textPrimary)
                if let caption {
                    caption
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, minHeight: Size.rowMinHeight, alignment: .leading)
        .koboCard(padding: Space.md)
        .accessibilityElement(children: .combine)
    }
}

#if DEBUG
    private struct SectionEmptyCardPreview: View {
        var body: some View {
            VStack(spacing: Space.lg) {
                SectionEmptyCard("No sessions yet", caption: "Logged sessions show here.", systemImage: "figure.run")
                SectionEmptyCard(verbatim: "Nothing shared with you")
            }
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Section empty card") { SectionEmptyCardPreview() }
    #Preview("Section empty card · dark, Lift") {
        SectionEmptyCardPreview().koboTheme(.lift).preferredColorScheme(.dark)
    }
    #Preview("Section empty card · AX3") { SectionEmptyCardPreview().dynamicTypeSize(.accessibility3) }
#endif
