import KoboTokens
import SwiftUI

/// Attaching to a `ChatComposer`: what is attached, how each tile's picture is found, and what the + button and the
/// tiles do. The + usually presents `.chatAttachPicker`; the caller uploads what it hands back and updates `items`.
///
///     ChatComposer(text: $draft, prompt: "Message", onSend: send, attach: ChatAttach(
///         items: attachments, preview: { thumbnails[$0.id] }, onAdd: { picking = true }, onRemove: remove))
public struct ChatAttach {
    public var items: [ChatAttachment]
    public var preview: (ChatAttachment) -> Image?
    public var onAdd: () -> Void
    public var onRemove: (ChatAttachment) -> Void
    public var onRetry: ((ChatAttachment) -> Void)?
    /// Whether the + is enabled (false once the message holds as many as it can take).
    public var canAdd: Bool

    public init(
        items: [ChatAttachment],
        preview: @escaping (ChatAttachment) -> Image?,
        onAdd: @escaping () -> Void,
        onRemove: @escaping (ChatAttachment) -> Void,
        onRetry: ((ChatAttachment) -> Void)? = nil,
        canAdd: Bool = true
    ) {
        self.items = items
        self.preview = preview
        self.onAdd = onAdd
        self.onRemove = onRemove
        self.onRetry = onRetry
        self.canAdd = canAdd
    }

    /// Where the attachments stand, for the send button.
    var readiness: ChatComposerLogic.Attachments { ChatAttachmentLogic.readiness(items) }
}

/// The composer's + : a bare glyph, like the microphone.
struct ChatAttachButton: View {
    @ScaledMetric(relativeTo: .body) private var circle = Size.buttonHeightCompact
    let isEnabled: Bool
    /// In the open card's toolbar: a filled round button; in the capsule: a bare glyph.
    var isFilled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ChatRoundGlyph(systemImage: "plus", look: isEnabled ? (isFilled ? .quiet : .bare) : .dimmed, circle: circle)
        }
        .buttonStyle(.plain)
        .pressFeedback()
        .disabled(!isEnabled)
        .accessibilityLabel(Text("Add photos and files", bundle: .module))
    }
}
