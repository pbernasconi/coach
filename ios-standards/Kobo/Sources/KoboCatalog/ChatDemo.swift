import KoboComponents
import KoboTokens
import SwiftUI

/// Live demos for the Chat section: a short assistant conversation about planning a weekend trip.
struct ChatDemo: View {
    let component: CatalogComponent
    @State private var draft = ""
    @State private var responding = false
    @State private var phase = ChangeSetPhase.proposed

    var body: some View {
        switch component {
        case .chatTranscript: transcript
        case .chatBubble:
            VStack(spacing: Space.md) {
                ChatBubble(verbatim: "Can we push dinner to Saturday?")
                ChatBubble(verbatim: "And book a table for four", delivery: .sending)
                ChatBubble(verbatim: "Thanks!", delivery: .failed(retry: {}))
            }
        case .chatReply:
            ChatReply(markdown: Self.reply, isStreaming: responding)
        case .typingIndicator: TypingIndicator()
        case .chatStatusRow:
            VStack(alignment: .leading, spacing: Space.sm) {
                ChatStatusRow("Reading your calendar", state: .working)
                ChatStatusRow("Checked 3 restaurants", state: .done)
                ChatStatusRow("Couldn't reach the booking site", state: .failed)
            }
        case .chatComposer:
            ChatComposer(
                text: $draft,
                prompt: "Message",
                isResponding: responding,
                onSend: send,
                onStop: { responding = false }
            )
        case .changeSetCard:
            ChangeSetCard(
                verbatim: "Move dinner to Saturday",
                changes: Self.changes,
                phase: phase,
                onApply: apply,
                onDismiss: dismiss,
                onUndo: undo,
                context: { Text("Based on your calendar for the weekend") }
            )
        default: EmptyView()
        }
    }

    private func send() {
        draft = ""
        responding = true
    }

    private func apply() { phase = .applied }
    private func dismiss() { phase = .dismissed }
    private func undo() { phase = .proposed }

    private var transcript: some View {
        ChatTranscript(Self.messages) { message in
            if message.mine {
                ChatBubble(verbatim: message.text)
            } else {
                ChatReply(markdown: message.text)
            }
        } footer: {
            TypingIndicator()
        }
        .frame(height: Size.minTouch * 8)
    }

    private struct Message: Identifiable {
        let id: Int
        let mine: Bool
        let text: String
    }

    private static let messages = [
        Message(id: 0, mine: true, text: "Friday is packed. Can dinner move?"),
        Message(id: 1, mine: false, text: Self.reply),
        Message(id: 2, mine: true, text: "Saturday works"),
    ]

    private static let reply = """
        Friday has meetings until **7 pm**. Two options:
        - Saturday at 7:30, same place
        - Sunday lunch at 12:30
        """

    private static let changes = [
        ChangeItem(.changed, title: "Dinner with Sam", detail: "Fri 7:00 pm → Sat 7:30 pm"),
        ChangeItem(.added, title: "Reminder to confirm the table", detail: "Sat 10:00 am"),
        ChangeItem(.removed, title: "Hold on Friday evening"),
    ]
}
