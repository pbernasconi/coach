import KoboTokens
import SwiftUI

/// A starter prompt: the text a tap puts in the composer, and an optional glyph.
nonisolated public struct ChatPrompt: Identifiable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let systemImage: String?

    public init(id: String, title: String, systemImage: String? = nil) {
        self.id = id
        self.title = title
        self.systemImage = systemImage
    }
}

/// Starter prompts for an empty or quiet chat, as capsules that wrap onto more lines. A tap hands the prompt to the
/// caller, which usually fills the composer (so the reader can add detail) rather than sending at once.
///
///     ChatPromptSuggestions(prompts, onSelect: { draft = $0.title; isFocused = true })
public struct ChatPromptSuggestions: View {
    private let prompts: [ChatPrompt]
    private let onSelect: (ChatPrompt) -> Void

    public init(_ prompts: [ChatPrompt], onSelect: @escaping (ChatPrompt) -> Void) {
        self.prompts = prompts
        self.onSelect = onSelect
    }

    public var body: some View {
        FlowLayout(spacing: Space.sm, lineSpacing: Space.sm) {
            ForEach(prompts) { prompt in
                ChatPromptButton(prompt: prompt) { onSelect(prompt) }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct ChatPromptButton: View {
    @Environment(\.koboTheme) private var theme
    let prompt: ChatPrompt
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Space.xs) {
                if let symbol = prompt.systemImage {
                    Image(systemName: symbol)
                        .foregroundStyle(theme.palette.accentText)
                        .accessibilityHidden(true)
                }
                Text(verbatim: prompt.title)
                    .foregroundStyle(theme.palette.textPrimary)
            }
            .font(theme.font(.subheadline))
            .padding(.horizontal, Space.md)
            .frame(minHeight: Size.minTouch)
            .background(theme.palette.surface, in: Capsule())
            .overlay { Capsule().strokeBorder(theme.palette.separator, lineWidth: Size.hairline) }
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .pressFeedback()
    }
}

#if DEBUG
    private struct ChatPromptSuggestionsPreview: View {
        var body: some View {
            ChatPromptSuggestions(
                [
                    ChatPrompt(id: "move", title: "Move today's review", systemImage: "arrow.right"),
                    ChatPrompt(id: "short", title: "I'm short on time", systemImage: "clock"),
                    ChatPrompt(id: "week", title: "How did my week go?", systemImage: "calendar"),
                    ChatPrompt(id: "off", title: "Take Friday off"),
                ],
                onSelect: { _ in }
            )
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Prompt suggestions") { ChatPromptSuggestionsPreview() }
    #Preview("Prompt suggestions · dark") { ChatPromptSuggestionsPreview().preferredColorScheme(.dark) }
    #Preview("Prompt suggestions · AX3") { ChatPromptSuggestionsPreview().dynamicTypeSize(.accessibility3) }
#endif
