import Foundation
import KoboComponents
import Testing

@testable import Lift

/// Photos and files on a message (lift/COACH-CHAT.md, "Attachments"): they upload when picked, Send waits for them,
/// and the sent message carries them.
@MainActor
@Suite struct CoachAttachTests {
    private func make(_ coach: FakeCoach) -> CoachViewModel {
        CoachViewModel(
            coach: coach,
            plan: FakeCoachPlan([]),
            router: RecordingNavigator(),
            tabs: RecordingTabs(),
            mediaLoader: LiftSessionMediaLoader(),
            speech: FakeSpeech(),
            clock: ImmediateClock(),
            settings: RecordingAppSettings(),
            presence: CoachPresence()
        )
    }

    private func photo(_ id: String) -> ChatPickedFile {
        ChatPickedFile(
            id: id,
            kind: .image,
            name: "Photo",
            contentType: "image/jpeg",
            data: Data([1]),
            pixelWidth: 1,
            pixelHeight: 1,
            preview: Data([2])
        )
    }

    @Test func thePlusOpensAndClosesTheSheet() {
        let vm = make(FakeCoach(.success(CoachReply(text: "ok"))))
        vm.send(.attachShown(true))
        #expect(vm.state.isAttaching)
        vm.send(.attachShown(false))
        #expect(!vm.state.isAttaching)
    }

    @Test func pickedPhotosUploadAndGoWithTheMessage() async {
        let coach = FakeCoach(.success(CoachReply(text: "Nice form.")))
        let vm = make(coach)
        await vm.send(.filesPicked([photo("a"), photo("b")]))?.value
        #expect(vm.state.attachments.map(\.state) == [.ready, .ready])
        #expect(vm.state.previews["a"] == Data([2]))
        #expect(vm.state.canSend)  // photos alone can go
        await vm.send(.sendTapped)?.value
        #expect(vm.state.attachments.isEmpty)
        let mine = vm.state.messages.first
        #expect(mine?.body == .mine(""))
        #expect(mine?.files.map(\.id) == ["f-a", "f-b"])
        #expect(vm.state.previews["f-a"] == Data([2]))  // the sent tile shows the picked photo at once
        #expect(await coach.uploads == ["Photo", "Photo"])
    }

    @Test func aFailedUploadHoldsSendUntilItsRetriedOrRemoved() async {
        let coach = FakeCoach(.success(CoachReply(text: "ok")))
        await coach.setFailsUpload(true)
        let vm = make(coach)
        vm.send(.draftChanged("Look"))
        await vm.send(.filesPicked([photo("a")]))?.value
        #expect(vm.state.attachments.first?.state == .failed)
        #expect(!vm.state.canSend)
        await coach.setFailsUpload(false)
        await vm.send(.attachmentRetried("a"))?.value
        #expect(vm.state.attachments.first?.state == .ready)
        vm.send(.attachmentRemoved("a"))
        #expect(vm.state.attachments.isEmpty)
        #expect(vm.state.previews["a"] == nil)
        #expect(vm.state.canSend)
    }

    @Test func aMessageTakesAtMostSix() async {
        let vm = make(FakeCoach(.success(CoachReply(text: "ok"))))
        await vm.send(.filesPicked((1...8).map { photo("\($0)") }))?.value
        #expect(vm.state.attachments.count == CoachState.attachmentLimit)
    }

    @Test func messagesCarryTheirFilesFromTheServer() throws {
        let json = Data(
            #"""
            { "messages": [{ "id": "m1", "role": "user", "text": "", "proposal": null,
              "files": [{ "id": "f1", "kind": "image", "name": "Photo", "contentType": "image/jpeg", "sizeBytes": 9,
                          "width": 1, "height": 1 },
                        { "id": "f2", "kind": "pdf", "name": "Plan.pdf", "contentType": "application/pdf",
                          "sizeBytes": 9, "width": null, "height": null }] }] }
            """#.utf8
        )
        let thread = CoachWire.thread(try JSONDecoder().decode(CoachWire.Thread.self, from: json))
        #expect(
            thread.messages.first?.files == [
                CoachFile(id: "f1", kind: .image, name: "Photo"), CoachFile(id: "f2", kind: .file, name: "Plan.pdf"),
            ]
        )
    }
}
