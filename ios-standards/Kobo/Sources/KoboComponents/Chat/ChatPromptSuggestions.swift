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

/// Starter prompts for an empty chat: quiet capsules in one row that scrolls sideways, docked above the composer. The
/// row pays the page gutter itself, so place it edge to edge. A tap hands the prompt to the caller, which usually fills
/// the composer (so the reader can add detail) rather than sending at once. The glyph is not shown.
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
        ScrollView(.horizontal) {
            HStack(spacing: Space.sm) {
                ForEach(prompts) { prompt in
                    ChatPromptButton(prompt: prompt) { onSelect(prompt) }
                }
            }
            .padding(.horizontal, Space.gutter)
        }
        .scrollIndicators(.hidden)
        .scrollClipDisabled()
    }
}

private struct ChatPromptButton: View {
    @Environment(\.koboTheme) private var theme
    let prompt: ChatPrompt
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(verbatim: prompt.title)
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textPrimary)
                .lineLimit(1)
                .padding(.horizontal, Space.md + Space.xxs)
                .frame(minHeight: Size.buttonHeightCompact)
                .background(theme.palette.surfaceSunken, in: Capsule())
                .frame(minHeight: Size.minTouch)
                .contentShape(Rectangle())
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
