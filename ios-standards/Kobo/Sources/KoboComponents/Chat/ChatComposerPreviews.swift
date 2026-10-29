import KoboTokens
import SwiftUI

#if DEBUG
    private struct ChatComposerPreview: View {
        @State private var empty = ""
        @State private var draft = "Can we move the review to tomorrow morning?"
        private let attached = [
            ChatAttachment(id: "a", kind: .image, name: "Photo"),
            ChatAttachment(id: "b", kind: .file, name: "Agenda.pdf", state: .uploading),
        ]

        private func attach(_ items: [ChatAttachment]) -> ChatAttach {
            ChatAttach(items: items, preview: { _ in nil }, onAdd: {}, onRemove: { _ in })
        }

        var body: some View {
            VStack(spacing: Space.lg) {
                Spacer()
                ChatComposer(text: $empty, prompt: "Message", onSend: {})
                ChatComposer(text: $empty, prompt: "Ask anything…", onSend: {}, attach: attach([])).restsAsCard()
                ChatComposer(text: $draft, prompt: "Message", onSend: {})
                ChatComposer(text: $empty, prompt: "Message", onSend: {}, attach: attach([]))
                ChatComposer(text: $empty, prompt: "Message", onSend: {}, attach: attach(attached))
                ChatComposer(
                    text: $draft,
                    prompt: "Message",
                    onSend: {},
                    voice: ChatVoice(phase: .listening, level: 0.6, onTap: {}, onHoldBegan: {}, onHoldEnded: {})
                )
                ChatComposer(
                    text: $empty,
                    prompt: "Message",
                    onSend: {},
                    voice: ChatVoice(
                        phase: .unavailable,
                        onTap: {},
                        onHoldBegan: {},
                        onHoldEnded: {},
                        onOpenSettings: {}
                    )
                )
                ChatComposer(text: $empty, prompt: "Message", isResponding: true, onSend: {}, onStop: {})
            }
            .screenCanvas()
        }
    }

    #Preview("Composer") { ChatComposerPreview() }
    #Preview("Composer · dark, solid") {
        ChatComposerPreview().koboTheme(Theme(palette: .amber, surfaceStyle: .solid)).preferredColorScheme(.dark)
    }
    #Preview("Composer · AX3") { ChatComposerPreview().dynamicTypeSize(.accessibility3) }
#endif
