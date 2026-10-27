import Foundation
import Testing

@testable import KoboComponents

@Suite struct ChatAttachmentTests {
    private func item(_ id: String, _ state: ChatAttachment.State) -> ChatAttachment {
        ChatAttachment(id: id, kind: .image, name: "Photo", state: state)
    }

    @Test func sendWaitsForEveryUpload() {
        #expect(ChatAttachmentLogic.readiness([]) == .none)
        #expect(ChatAttachmentLogic.readiness([item("a", .ready), item("b", .ready)]) == .ready)
        #expect(ChatAttachmentLogic.readiness([item("a", .ready), item("b", .uploading)]) == .pending)
        #expect(ChatAttachmentLogic.readiness([item("a", .failed)]) == .pending)
    }

    @Test func attachmentsAloneCanBeSentOnceUploaded() {
        #expect(ChatComposerLogic.canSend("", attachments: .ready))
        #expect(!ChatComposerLogic.canSend("hi", attachments: .pending))
        #expect(!ChatComposerLogic.canSend(" ", attachments: .none))
        #expect(
            ChatComposerLogic.button(draft: "", attachments: .ready, isResponding: false, canStop: true)
                == .send(isEnabled: true)
        )
        #expect(
            ChatComposerLogic.compactButton(
                draft: "",
                attachments: .ready,
                isResponding: false,
                canStop: true,
                hasVoice: true
            ) == .send
        )
        #expect(
            ChatComposerLogic.compactButton(
                draft: "hi",
                attachments: .pending,
                isResponding: false,
                canStop: true,
                hasVoice: true
            ) == .microphone
        )
    }

    @Test func theComposerOpensWhileSomethingIsAttached() {
        #expect(ChatComposerLogic.isExpanded(isFocused: false, isListening: false, hasAttachments: true))
        #expect(!ChatComposerLogic.isExpanded(isFocused: false, isListening: false, hasAttachments: false))
    }

    @Test func pickingKeepsTheOrderAndTheLimit() {
        var picked: [String] = []
        for id in ["c", "a", "b"] { picked = ChatAttachmentLogic.toggled(id, in: picked, limit: 2) }
        #expect(picked == ["c", "a"])
        picked = ChatAttachmentLogic.toggled("c", in: picked, limit: 2)
        #expect(picked == ["a"])
        #expect(ChatAttachmentLogic.room(for: [item("a", .ready)], limit: 6) == 5)
        #expect(ChatAttachmentLogic.room(for: Array(repeating: item("a", .ready), count: 7), limit: 6) == 0)
    }

    private func fit(_ width: Int, _ height: Int) -> [Int] {
        let size = ChatImageFit.fitted(width: width, height: height)
        return [size.width, size.height]
    }

    @Test func photosShrinkToTheLongSideAndNeverGrow() {
        #expect(fit(4032, 3024) == [1568, 1176])
        #expect(fit(1179, 2556) == [723, 1568])
        #expect(fit(800, 600) == [800, 600])
        #expect(fit(0, 600) == [0, 0])
    }

    @Test func aPickedFileStartsUploading() {
        let file = ChatPickedFile(id: "x", kind: .file, name: "Notes.txt", contentType: "text/plain", data: .init())
        #expect(file.attachment == ChatAttachment(id: "x", kind: .file, name: "Notes.txt", state: .uploading))
    }
}
