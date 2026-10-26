import KoboTokens
import SwiftUI

/// The reader's own message in a chat: a tinted bubble on the trailing side, at most about four fifths of the width.
/// Long-press offers Copy. A message that is still on its way says so under the bubble. VoiceOver reads "You:" and
/// the text as one element.
///
///     ChatMessageBubble(verbatim: draft)
///     ChatMessageBubble(verbatim: message.text, isSending: message.isSending)
public struct ChatMessageBubble: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var leadingRoom = Space.xxxl * 2
    private let text: String
    private let isSending: Bool

    /// A bubble for the reader's message; `isSending` adds a "Sending…" caption until the message arrives.
    public init(verbatim text: String, isSending: Bool = false) {
        self.text = text
        self.isSending = isSending
    }

    public var body: some View {
        HStack(spacing: 0) {
            Spacer(minLength: leadingRoom)
            VStack(alignment: .trailing, spacing: Space.xs) {
                Text(verbatim: text)
                    .font(theme.font(.body))
                    .foregroundStyle(theme.palette.textPrimary)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
                    .padding(.horizontal, Space.md + Space.xxs)
                    .padding(.vertical, Space.sm + Space.xxs)
                    .background(theme.palette.accentSoft, in: RoundedRectangle(cornerRadius: Radius.lg))
                    .contextMenu {
                        Button {
                            ChatPasteboard.copy(text)
                        } label: {
                            Label {
                                Text("Copy", bundle: .module)
                            } icon: {
                                Image(systemName: "doc.on.doc")
                            }
                        }
                    }
                if isSending {
                    Text("Sending…", bundle: .module)
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.palette.textTertiary)
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text("You: \(text)", bundle: .module))
    }
}

/// Copies chat text to the system pasteboard.
enum ChatPasteboard {
    static func copy(_ text: String) {
        #if canImport(UIKit)
            UIPasteboard.general.string = text
        #elseif canImport(AppKit)
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(text, forType: .string)
        #endif
    }
}

#if DEBUG
    private struct ChatMessageBubblePreview: View {
        var body: some View {
            VStack(spacing: Space.lg) {
                ChatMessageBubble(verbatim: "Can we push the team review to tomorrow morning?")
                ChatMessageBubble(verbatim: "Thanks!")
                ChatMessageBubble(verbatim: "And add a short call with the designer after lunch.", isSending: true)
            }
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Message bubble") { ChatMessageBubblePreview() }
    #Preview("Message bubble · dark") { ChatMessageBubblePreview().preferredColorScheme(.dark) }
    #Preview("Message bubble · AX3") { ChatMessageBubblePreview().dynamicTypeSize(.accessibility3) }
#endif
