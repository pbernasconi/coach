import KoboComponents
import KoboTokens
import SwiftUI

/// Live demos for the Chat section.
struct ChatDemo: View {
    let component: CatalogComponent
    @State private var draft = ""
    @State private var status = ChatActionStatus.pending
    @State private var isResponding = false
    @State private var voice = ChatVoiceInput()
    @State private var attached = ChatDemoSamples.attachments
    @State private var picked: [String] = []
    @State private var isAdding = false

    var body: some View {
        switch component {
        case .chatTranscript:
            ChatTranscript(ChatDemoSamples.lines) { line in
                if line.isMine { ChatMessageBubble(verbatim: line.text) } else { ChatReply(verbatim: line.text) }
            } footer: {
                ChatTypingIndicator(verbatim: "Checking the calendar")
            }
            .frame(height: 360)
        case .chatComposer:
            ChatComposer(
                text: $draft,
                prompt: "Message",
                isResponding: isResponding,
                onSend: { isResponding = true },
                onStop: { isResponding = false },
                voice: ChatVoice(
                    phase: voice.phase,
                    level: voice.isListening ? 0.5 : 0,
                    onTap: { _ = voice.tapped() },
                    onHoldBegan: { _ = voice.holdBegan() },
                    onHoldEnded: { _ = voice.holdEnded() }
                ),
                attach: ChatAttach(
                    items: attached,
                    preview: { _ in nil },
                    onAdd: { isAdding = true },
                    onRemove: { item in attached.removeAll { $0.id == item.id } }
                )
            )
            .chatAttachDemoPicker(isPresented: $isAdding) { files in attached += files.map(\.attachment) }
        case .chatMessageBubble:
            ChatMessageBubble(verbatim: "Can we move the review to tomorrow morning?")
        case .chatReply:
            ChatReply(verbatim: ChatDemoSamples.reply)
        case .chatTypingIndicator:
            ChatTypingIndicator(verbatim: "Reading your calendar")
        case .chatToolStatus:
            VStack(spacing: Space.sm) {
                ChatToolStatus(verbatim: "Read this week's tasks", state: .done)
                ChatToolStatus(verbatim: "Checking tomorrow's calendar", state: .running)
                ChatToolStatus(verbatim: "Could not read the forecast", state: .failed)
            }
        case .chatActionCard:
            ChatActionCard(
                verbatim: "2 changes this week",
                items: ChatDemoSamples.changes,
                status: status,
                onApply: { status = .applied },
                onDismiss: { status = .dismissed },
                onUndo: { status = .pending }
            )
        case .chatChangeCard:
            ChatChangeCard(
                verbatim: "Move the review",
                summary: "2 changes · Tue 3 to Wed 4 Mar",
                sections: [
                    ChatChangeSection(id: "tue", title: "Tue 3 Mar", rows: [
                        ChatChangeRow(id: "1", title: "Design sync", caption: "10:00 · 30 min", tag: "Skipped", tone: .removed, systemImage: "person.2"),
                    ]),
                    ChatChangeSection(id: "wed", title: "Wed 4 Mar", rows: [
                        ChatChangeRow(id: "2", title: "Team review", caption: "09:00 · 1 h", tag: "From Tue", tone: .changed, systemImage: "person.3"),
                    ]),
                ],
                checked: "Checked against your calendar: no clashes",
                status: status,
                onApply: { status = .applied },
                onDismiss: { status = .dismissed },
                onUndo: { status = .pending }
            )
        case .chatTimestamp:
            VStack(spacing: Space.lg) {
                ChatTimestamp(.now.addingTimeInterval(-20 * 60), now: .now)
                ChatTimestamp(.now.addingTimeInterval(-30 * 3600), now: .now)
                ChatTimestamp(.now.addingTimeInterval(-9 * 86400), now: .now)
            }
        case .chatPromptSuggestions:
            ChatPromptSuggestions(ChatDemoSamples.prompts) { draft = $0.title }
        case .chatErrorRow:
            ChatErrorRow(verbatim: "The assistant could not answer. Check your connection.", onRetry: {})
        case .chatEmbedCard:
            ChatEmbedCard(verbatim: "Team review", subtitle: "Tue 09:00 · 45 min", systemImage: "calendar", action: {})
            {
                Text(verbatim: "Agenda: the launch plan, then questions.")
            }
        case .chatAttachmentStrip:
            ChatAttachmentStrip(
                attached,
                preview: { _ in nil },
                onRemove: { item in attached.removeAll { $0.id == item.id } }
            )
        case .chatAttachSheet:
            ChatAttachSheet(
                "Add to message",
                recents: (1...8).map { ChatPhotoTile(id: "\($0)") },
                selection: $picked,
                onClose: { picked = [] },
                onCamera: {},
                onLibrary: {},
                onFiles: {},
                onAttach: { picked = [] }
            )
            .frame(height: 360)
        default: ChatAssistantDemo(component: component)
        }
    }
}

/// Made-up chat content for the demos.
private enum ChatDemoSamples {
    struct Line: Identifiable {
        let id: Int
        let isMine: Bool
        let text: String
    }

    static let lines = [
        Line(id: 0, isMine: true, text: "Can we push the team review to tomorrow?"),
        Line(id: 1, isMine: false, text: "Tomorrow is free from **09:00 to 10:30**. Moving it there."),
        Line(id: 2, isMine: true, text: "Great, and add a short call with the designer."),
    ]

    static let reply = """
        Here is the new plan:

        - **Tuesday:** team review at 09:00
        - **Wednesday:** design call after lunch
        """

    static let changes = [
        ChatActionItem(id: "review", change: .move, title: "Team review", detail: "Wed 09:00", previous: "Tue 17:00"),
        ChatActionItem(id: "call", change: .add, title: "Design call", detail: "Wed 13:30 · 30 min"),
    ]

    static let attachments = [
        ChatAttachment(id: "map", kind: .image, name: "Map"),
        ChatAttachment(id: "agenda", kind: .file, name: "Agenda.pdf"),
    ]

    static let prompts = [
        ChatPrompt(id: "move", title: "Move today's review", systemImage: "arrow.right"),
        ChatPrompt(id: "short", title: "I'm short on time", systemImage: "clock"),
        ChatPrompt(id: "week", title: "How did my week go?", systemImage: "calendar"),
    ]
}

extension View {
    /// The real picker on iOS; nothing on macOS, where the catalog has no photo library.
    @ViewBuilder
    fileprivate func chatAttachDemoPicker(
        isPresented: Binding<Bool>,
        onPick: @escaping ([ChatPickedFile]) -> Void
    ) -> some View {
        #if os(iOS)
            chatAttachPicker(isPresented: isPresented, onPick: onPick)
        #else
            self
        #endif
    }
}
