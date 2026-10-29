import Foundation
import KoboComponents

/// The composer's microphone for the Coach tab: runs what Kobo's `ChatVoiceInput` rules ask (start or stop the engine,
/// or stop and send what was heard) and puts the words in the draft as they are heard. Reads and changes the tab's
/// state through `read` and `edit`, which `CoachViewModel` hands it; `send` sends the draft.
@MainActor
final class CoachMicrophone {
    private let dictation: CoachDictation
    private let read: () -> CoachState
    private let edit: ((inout CoachState) -> Void) -> Void
    private let send: () -> Task<Void, Never>?
    /// The draft before listening began, and the words heard since.
    private var draftBeforeVoice = ""
    private var heard = ""

    init(
        dictation: CoachDictation,
        read: @escaping () -> CoachState,
        edit: @escaping ((inout CoachState) -> Void) -> Void,
        send: @escaping () -> Task<Void, Never>?
    ) {
        self.dictation = dictation
        self.read = read
        self.edit = edit
        self.send = send
    }

    @discardableResult
    func run(_ effect: ChatVoiceInput.Effect) -> Task<Void, Never>? {
        switch effect {
        case .none: return nil
        case .start:
            let draft = read().draft
            draftBeforeVoice = draft.isEmpty || draft.hasSuffix(" ") || draft.hasSuffix("\n") ? draft : draft + " "
            heard = ""
            return dictation.start { [weak self] in self?.heard($0) }
        case .stop:
            dictation.stop()
            edit { $0.voiceLevel = 0 }
            return nil
        case .stopAndSend:
            dictation.stop()
            edit { $0.voiceLevel = 0 }
            guard ChatVoiceInput.message(toSend: heard) != nil else { return nil }
            return send()
        }
    }

    private func heard(_ event: CoachDictation.Event) {
        switch event {
        case .words(let text):
            guard read().voice.isListening else { return }
            heard = text
            let draft = draftBeforeVoice + text
            edit { $0.draft = draft }
        case .level(let level): edit { $0.voiceLevel = level }
        case .paused:
            var voice = read().voice
            let effect = voice.pausedLongEnough()
            edit { $0.voice = voice }
            run(effect)
        case .ended: edit { $0.voice.ended(); $0.voiceLevel = 0 }
        case .failed(let denied): edit { $0.voice.failed(denied: denied); $0.voiceLevel = 0 }
        }
    }
}
