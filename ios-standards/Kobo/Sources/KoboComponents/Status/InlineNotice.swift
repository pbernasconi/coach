import KoboTokens
import SwiftUI

/// A small note inside a form or a screen body that asks for no choice. Without a tone it is a neutral note on the
/// sunken fill; with a tone it is a tinted note whose glyph carries the meaning, so status never reads by colour alone.
/// It can carry one underlined action under the text. Smaller and quieter than `NoticeBanner`: no title, no dismiss.
///
///     InlineNotice("We'll email a receipt to the address on file.")
///     InlineNotice("Changes apply from next week.", tone: .warning)
///     InlineNotice("Notifications are off.", tone: .warning, action: .init("Open Settings", perform: openSettings))
public struct InlineNotice: View {
    @Environment(\.koboTheme) private var theme
    private let lines: [Text]
    private let tone: Tone?
    private let action: BannerAction?

    /// A note with localized copy. `tone` `nil` draws the neutral note with no glyph.
    public init(_ text: LocalizedStringKey, tone: Tone? = nil, action: BannerAction? = nil) {
        self.init(lines: [Text(text)], tone: tone, action: action)
    }

    /// A note whose copy is shown as is.
    public init(verbatim text: String, tone: Tone? = nil, action: BannerAction? = nil) {
        self.init(lines: [Text(verbatim: text)], tone: tone, action: action)
    }

    /// A tinted note of several lines shown as is (one per warning). No lines draws nothing.
    public init(tone: Tone, verbatimLines lines: [String], action: BannerAction? = nil) {
        self.init(lines: lines.map { Text(verbatim: $0) }, tone: tone, action: action)
    }

    private init(lines: [Text], tone: Tone?, action: BannerAction?) {
        self.lines = lines
        self.tone = tone
        self.action = action
    }

    public var body: some View {
        if !lines.isEmpty {
            HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                if let tone {
                    Image(systemName: tone.feedbackSymbol)
                        .font(theme.font(.footnote).weight(.semibold))
                        .accessibilityHidden(true)
                }
                VStack(alignment: .leading, spacing: Space.xxs) {
                    copy
                    if let action { actionLink(action) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .foregroundStyle(ink)
            .padding(.horizontal, Space.md)
            .padding(.top, Space.sm)
            .padding(.bottom, action == nil ? Space.sm : 0)
            .background(fill, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            .accessibilityElement(children: action == nil ? .combine : .contain)
        }
    }

    private var copy: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                line.font(theme.font(.footnote)).fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func actionLink(_ action: BannerAction) -> some View {
        Button(action: action.perform) {
            action.label
                .font(theme.font(.footnote).weight(.semibold))
                .underline()
                .frame(minHeight: Size.minTouch)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var ink: Color { tone.map { theme.palette.status($0).ink } ?? theme.palette.textPrimary }
    private var fill: Color { tone.map { theme.palette.status($0).soft } ?? theme.palette.surfaceSunken }
}

#if DEBUG
    private struct InlineNoticePreview: View {
        var body: some View {
            VStack(spacing: Space.lg) {
                InlineNotice("We'll email a receipt to the address on file.")
                InlineNotice("Your plan restarts on Monday.", tone: .info)
                InlineNotice(tone: .warning, verbatimLines: ["Two events overlap.", "Free days are below two."])
                InlineNotice("This recipe needs an oven you don't have.", tone: .danger)
                InlineNotice("Notifications are off.", tone: .warning, action: .init("Open Settings") {})
            }
            .padding(Space.gutter)
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("Inline notice") { InlineNoticePreview() }
    #Preview("Inline notice · dark, Amber") { InlineNoticePreview().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Inline notice · AX3") { InlineNoticePreview().dynamicTypeSize(.accessibility3) }
#endif
