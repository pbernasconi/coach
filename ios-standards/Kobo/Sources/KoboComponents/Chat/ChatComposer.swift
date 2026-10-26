import KoboTokens
import SwiftUI

/// The message field of a chat: grows to six lines, then scrolls, with a trailing button that sends, or stops a reply
/// that is arriving. Return adds a line; only the button sends, and dictation never sends by itself. A leading slot
/// takes extra controls (attach, a voice button). Under a glass theme the field is one Liquid Glass shape; put it in a
/// `.safeAreaBar(edge: .bottom)` so the transcript scrolls under it.
///
///     ChatComposer(text: $draft, prompt: "Ask anything", isResponding: isReplying, onSend: send, onStop: stop)
public struct ChatComposer<Accessory: View>: View {
    @Environment(\.koboTheme) private var theme
    @Binding private var text: String
    private let prompt: Text
    private let isResponding: Bool
    private let onSend: () -> Void
    private let onStop: () -> Void
    private let accessory: Accessory
    @ScaledMetric(relativeTo: .body) private var button = Size.buttonHeightCompact

    public init(
        text: Binding<String>,
        prompt: LocalizedStringKey,
        isResponding: Bool,
        onSend: @escaping () -> Void,
        onStop: @escaping () -> Void,
        @ViewBuilder accessory: () -> Accessory
    ) {
        _text = text
        self.prompt = Text(prompt)
        self.isResponding = isResponding
        self.onSend = onSend
        self.onStop = onStop
        self.accessory = accessory()
    }

    public var body: some View {
        HStack(alignment: .bottom, spacing: Space.sm) {
            accessory
            TextField(text: $text, axis: .vertical) { prompt }
                .lineLimit(1...ChatMetrics.composerMaxLines)
                .font(theme.font(.body))
                .foregroundStyle(theme.palette.textPrimary)
                .padding(.vertical, (Size.minTouch - Size.iconLg) / 2)
            trailingButton
        }
        .padding(.leading, Space.lg)
        .padding(.trailing, Space.xs)
        .padding(.vertical, Space.xs)
        .background { surface }
    }

    private var action: ChatComposerAction { .current(text: text, isResponding: isResponding) }

    private var trailingButton: some View {
        Button {
            action == .stop ? onStop() : onSend()
        } label: {
            Image(systemName: action == .stop ? "stop.fill" : "arrow.up")
                .font(theme.font(.body).weight(.bold))
                .foregroundStyle(action == .none ? theme.palette.textTertiary : theme.palette.onAccent)
                .frame(width: button, height: button)
                .background(action == .none ? theme.palette.surfaceSunken : theme.palette.accent, in: Circle())
                .contentTransition(.symbolEffect(.replace))
                .frame(width: Size.minTouch, height: Size.minTouch)
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(action == .none)
        .koboAnimation(.state, value: action)
        .accessibilityLabel(action == .stop ? Text("Stop", bundle: .module) : Text("Send", bundle: .module))
        .koboFeedback(trigger: isResponding) { was, now in !was && now ? .tap : nil }
    }

    @ViewBuilder private var surface: some View {
        let shape = RoundedRectangle(cornerRadius: Radius.xl, style: .continuous)
        if theme.surfaceStyle == .glass {
            Color.clear.glassEffect(.regular.interactive(), in: shape)
        } else {
            shape.fill(theme.palette.surface).overlay(
                shape.strokeBorder(theme.palette.separator, lineWidth: Size.hairline)
            )
        }
    }
}

extension ChatComposer where Accessory == EmptyView {
    /// A composer with only the field and its send button.
    public init(
        text: Binding<String>,
        prompt: LocalizedStringKey,
        isResponding: Bool,
        onSend: @escaping () -> Void,
        onStop: @escaping () -> Void
    ) {
        self.init(text: text, prompt: prompt, isResponding: isResponding, onSend: onSend, onStop: onStop) {
            EmptyView()
        }
    }
}

#if DEBUG
    private struct ChatComposerPreview: View {
        @Environment(\.koboTheme) private var theme
        @State private var empty = ""
        @State private var draft = "Can we push dinner to eight?"
        @State private var long =
            "A longer message that wraps onto a few lines so the field grows with it as you type more."
        var body: some View {
            VStack(spacing: Space.lg) {
                ChatComposer(text: $empty, prompt: "Message", isResponding: false, onSend: {}, onStop: {}) {
                    IconButton("mic", accessibilityLabel: "Dictate", style: .plain) {}
                }
                ChatComposer(text: $draft, prompt: "Message", isResponding: false, onSend: {}, onStop: {})
                ChatComposer(text: $long, prompt: "Message", isResponding: true, onSend: {}, onStop: {})
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("ChatComposer") { ChatComposerPreview() }
    #Preview("ChatComposer · dark") { ChatComposerPreview().preferredColorScheme(.dark) }
    #Preview("ChatComposer · AX3") { ChatComposerPreview().dynamicTypeSize(.accessibility3) }
#endif
