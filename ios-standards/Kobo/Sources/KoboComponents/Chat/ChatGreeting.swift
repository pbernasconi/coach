import KoboTokens
import SwiftUI

/// The welcome of an empty chat: a small mark, then a centred two-line greeting in title type, regular weight ("Hi
/// Sam," / "How can I help?"). The mark is a sparkle unless the caller passes its own (an app's brand mark).
///
///     ChatGreeting(verbatim: "Hi Sam,", "How can I help?") { BrandMark(size: 24) }
public struct ChatGreeting<Mark: View>: View {
    @Environment(\.koboTheme) private var theme
    private let lines: [String]
    private let mark: Mark

    /// A greeting of one or more lines under the caller's mark.
    public init(verbatim lines: String..., @ViewBuilder mark: () -> Mark) {
        self.lines = lines
        self.mark = mark()
    }

    public var body: some View {
        VStack(spacing: Space.lg) {
            mark.accessibilityHidden(true)
            Text(verbatim: lines.joined(separator: "\n"))
                .font(theme.font(.title).weight(.regular))
                .foregroundStyle(theme.palette.textPrimary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
        }
        .frame(maxWidth: .infinity)
    }
}

extension ChatGreeting where Mark == ChatSparkle {
    /// A greeting under the default sparkle.
    public init(verbatim lines: String...) {
        self.lines = lines
        self.mark = ChatSparkle()
    }
}

/// Starter prompts for an empty chat as stacked, full-width cards: a light grey fill, no border, a small glyph at the
/// leading edge (a sparkle when the prompt has none) and up to two lines of text. A tap hands the prompt to the caller.
///
///     ChatPromptCards(prompts) { draft = $0.title }
public struct ChatPromptCards: View {
    private let prompts: [ChatPrompt]
    private let onSelect: (ChatPrompt) -> Void

    public init(_ prompts: [ChatPrompt], onSelect: @escaping (ChatPrompt) -> Void) {
        self.prompts = prompts
        self.onSelect = onSelect
    }

    public var body: some View {
        VStack(spacing: Space.sm) {
            ForEach(prompts) { prompt in
                ChatPromptCard(prompt: prompt) { onSelect(prompt) }
            }
        }
    }
}

private struct ChatPromptCard: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var glyph = Size.iconMd
    let prompt: ChatPrompt
    let action: () -> Void

    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: Radius.md + Space.xxs, style: .continuous) }

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: Space.md) {
                Image(systemName: prompt.systemImage ?? "sparkles")
                    .font(theme.font(.subheadline))
                    .foregroundStyle(theme.palette.textSecondary)
                    .frame(width: glyph, height: glyph)
                    .padding(.top, Space.xxs)
                    .accessibilityHidden(true)
                Text(verbatim: prompt.title)
                    .font(theme.font(.body))
                    .foregroundStyle(theme.palette.textPrimary)
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, Space.lg + Space.xxs)
            .padding(.vertical, Space.lg)
            .frame(maxWidth: .infinity, minHeight: Size.minTouch, alignment: .leading)
            .background(theme.palette.surfaceRaised, in: shape)
            .contentShape(shape)
        }
        .buttonStyle(.plain)
        .pressFeedback()
    }
}

/// A soft accent glow rising from the bottom edge, behind an empty chat's composer: the accent fading up over about a
/// fifth of the screen, fainter in dark mode. Decorative; it takes no touches. Put it in the screen's background.
///
///     .background(alignment: .bottom) { ChatGlow() }
public struct ChatGlow: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.colorScheme) private var colorScheme

    public init() {}

    public var body: some View {
        GeometryReader { proxy in
            LinearGradient(
                colors: [theme.palette.accent.opacity(0), theme.palette.accent.opacity(strength)],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: proxy.size.height * 0.24)
            .frame(maxHeight: .infinity, alignment: .bottom)
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private var strength: Double { colorScheme == .dark ? 0.22 : 0.32 }
}

#if DEBUG
    private struct ChatGreetingPreview: View {
        var body: some View {
            VStack(spacing: Space.xxl) {
                Spacer()
                ChatGreeting(verbatim: "Hi Sam,", "How can I help?")
                ChatPromptCards(
                    [
                        ChatPrompt(id: "a", title: "What's on my calendar tomorrow?", systemImage: "calendar"),
                        ChatPrompt(id: "b", title: "Move the team review to Thursday", systemImage: "arrow.right"),
                        ChatPrompt(id: "c", title: "Summarise last week"),
                    ],
                    onSelect: { _ in }
                )
                Spacer()
            }
            .padding(Space.gutter)
            .background { ChatGlow() }
            .screenCanvas()
        }
    }

    #Preview("Greeting") { ChatGreetingPreview() }
    #Preview("Greeting · dark") { ChatGreetingPreview().preferredColorScheme(.dark) }
    #Preview("Greeting · AX3") { ChatGreetingPreview().dynamicTypeSize(.accessibility3) }
#endif
