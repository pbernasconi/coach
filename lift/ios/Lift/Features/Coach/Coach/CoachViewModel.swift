import Foundation
import KoboComponents
import Observation

/// The Coach tab: sends messages, shows replies and applies the changes Coach proposes (lift/COACH-CHAT.md). It reads
/// the conversation again whenever the tab shows or the app comes back, and polls while Coach is still answering.
@Observable
final class CoachViewModel {
    private(set) var state = CoachState()
    private let coach: any CoachChatting
    private let plan: any CoachPlanProviding
    private let router: any Navigating
    private let tabs: any TabSwitching
    private let mediaLoader: any ExerciseMediaLoader
    private let dictation: CoachDictation
    private let clock: any Clock<Duration>
    private let settings: any AppSettingsOpening
    private let presence: CoachPresence
    private var replyTask: Task<Void, Never>?
    private var pollTask: Task<Void, Never>?
    /// The draft before listening began, and the words heard since.
    private var draftBeforeVoice = ""
    private var heard = ""

    init(
        coach: any CoachChatting,
        plan: any CoachPlanProviding,
        router: any Navigating,
        tabs: any TabSwitching,
        mediaLoader: any ExerciseMediaLoader,
        speech: any SpeechTranscribing,
        clock: any Clock<Duration>,
        settings: any AppSettingsOpening,
        presence: CoachPresence
    ) {
        self.coach = coach
        self.plan = plan
        self.router = router
        self.tabs = tabs
        self.mediaLoader = mediaLoader
        self.dictation = CoachDictation(speech: speech, clock: clock)
        self.clock = clock
        self.settings = settings
        self.presence = presence
    }

    /// Reads the conversation (each time the tab shows). A failure keeps what is on screen and shows the reason.
    func run() async {
        do {
            take(try await coach.thread())
        } catch let error as CoachChatError {
            state.notice = error.message
        } catch {
            state.notice = "Coach could not load the conversation."
        }
    }

    @discardableResult
    func send(_ action: CoachAction) -> Task<Void, Never>? {
        switch action {
        case .draftChanged(let text):
            state.draft = text
        case .promptPicked(let prompt):
            state.draft = prompt.title
        case .sendTapped:
            let text = state.draft.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty, !state.isResponding else { return nil }
            if state.voice.isListening { voice(state.voice.backgrounded()) }
            state.draft = ""
            state.append(.mine(text))
            return ask(text)
        case .retryTapped:
            guard let text = state.lastMessage, !state.isResponding else { return nil }
            return ask(text)
        case .stopTapped:
            for task in [replyTask, pollTask] { task?.cancel() }
            (replyTask, pollTask) = (nil, nil)
            state.phase = .idle
        case .applyTapped(let id):
            return change(id, from: .pending, showing: .applying) { try await self.coach.apply(id) }
        case .undoTapped(let id):
            return change(id, from: .applied, showing: nil) { try await self.coach.undo(id) }
        case .dismissTapped(let id):
            return change(id, from: .pending, showing: nil) { try await self.coach.dismiss(id) }
        case .quickReplyTapped(let text):
            state.draft = text
            return send(.sendTapped)
        case .workoutOpened, .exerciseOpened, .weekOpened, .todayOpened, .mediaNeeded:
            return card(action)
        case .micTapped, .micHoldBegan, .micHoldEnded, .voiceSettingsTapped, .shown, .sceneActive:
            return device(action)
        }
        return nil
    }

    /// The microphone, and the tab or the app coming and going.
    private func device(_ action: CoachAction) -> Task<Void, Never>? {
        switch action {
        case .micTapped: return voice(state.voice.tapped())
        case .micHoldBegan: return voice(state.voice.holdBegan())
        case .micHoldEnded: return voice(state.voice.holdEnded())
        case .voiceSettingsTapped: settings.openAppSettings()
        case .shown(let isShown):
            presence.isShown = isShown
            if !isShown { voice(state.voice.backgrounded()) }
        case .sceneActive(let isActive):
            guard isActive else { return voice(state.voice.backgrounded()) }
            return Task { await run() }
        default: break
        }
        return nil
    }

    /// The server's conversation replaces the one on screen, unless a reply is on its way here (it brings its own).
    private func take(_ thread: CoachThread) {
        if !thread.prompts.isEmpty { state.prompts = thread.prompts }
        state.notice = thread.notice
        guard replyTask == nil else { return }
        if !thread.messages.isEmpty { state.messages = thread.messages }
        if thread.answering {
            state.phase = .waiting
            poll()
        } else if pollTask == nil, case .failed = state.phase, case .coach? = state.messages.last?.body {
            state.phase = .idle  // the answer came while the app was away
        }
    }

    /// Reads the conversation every 3 s while Coach is answering, for up to 3 minutes.
    private func poll() {
        guard pollTask == nil else { return }
        pollTask = Task {
            for _ in 0..<60 {
                do { try await clock.sleep(for: .seconds(3)) } catch { return }
                guard let thread = try? await coach.thread(), !Task.isCancelled else { continue }
                if !thread.messages.isEmpty { state.messages = thread.messages }
                if !thread.answering { break }
            }
            guard !Task.isCancelled else { return }
            pollTask = nil
            state.phase = .idle
        }
    }

    /// Runs what the microphone's rules ask: start or stop the engine, or stop and send what was heard.
    @discardableResult
    private func voice(_ effect: ChatVoiceInput.Effect) -> Task<Void, Never>? {
        switch effect {
        case .none: return nil
        case .start:
            let draft = state.draft
            draftBeforeVoice = draft.isEmpty || draft.hasSuffix(" ") || draft.hasSuffix("\n") ? draft : draft + " "
            heard = ""
            return dictation.start { [weak self] in self?.heard($0) }
        case .stop:
            dictation.stop()
            state.voiceLevel = 0
            return nil
        case .stopAndSend:
            dictation.stop()
            state.voiceLevel = 0
            guard ChatVoiceInput.message(toSend: heard) != nil else { return nil }
            return send(.sendTapped)
        }
    }

    private func heard(_ event: CoachDictation.Event) {
        switch event {
        case .words(let text):
            guard state.voice.isListening else { return }
            heard = text
            state.draft = draftBeforeVoice + text
        case .level(let level): state.voiceLevel = level
        case .paused: voice(state.voice.pausedLongEnough())
        case .ended:
            state.voice.ended()
            state.voiceLevel = 0
        case .failed(let denied):
            state.voice.failed(denied: denied)
            state.voiceLevel = 0
        }
    }

    /// A card's actions: open its page, or load its picture.
    private func card(_ action: CoachAction) -> Task<Void, Never>? {
        switch action {
        case .workoutOpened(let id): router.open(.plannedWorkout(id))
        case .exerciseOpened(let key): router.open(.liftExercise(key))
        case .weekOpened: tabs.show(.week)
        case .todayOpened: tabs.show(.today)
        case .mediaNeeded(let url):
            guard state.media[url] == nil else { return nil }
            state.media[url] = .loading
            let loader = mediaLoader
            return Task { state.media[url] = await MediaImage.load(url, with: loader) }
        default: break
        }
        return nil
    }

    private func ask(_ text: String) -> Task<Void, Never> {
        state.phase = .waiting
        let history = state.messages
        let task = Task {
            do {
                for try await event in coach.replies(to: text, after: history) {
                    guard !Task.isCancelled else { return }
                    switch event {
                    case .progress(let progress): state.phase = .answering(progress)
                    case .reply(let reply): state.receive(reply)
                    }
                }
                replyTask = nil
            } catch {
                guard !Task.isCancelled, !(error is CancellationError) else { return }
                state.phase = .failed((error as? CoachChatError)?.message ?? "Coach could not answer. Check your connection.")
                replyTask = nil
                await run()  // the connection may have dropped while the server went on answering
            }
        }
        replyTask = task
        return task
    }

    /// Applies, undoes or dismisses a proposal: the card takes the status the coach answers, and goes back if the call
    /// fails. After a change to the plan, the Week tab fetches it again.
    private func change(
        _ id: String,
        from current: ChatActionStatus,
        showing busy: ChatActionStatus?,
        _ work: @escaping () async throws -> ChatActionStatus
    ) -> Task<Void, Never>? {
        guard state.busyProposal == nil, state.status(of: id) == current else { return nil }
        state.busyProposal = id
        if let busy { state.setStatus(busy, of: id) }
        return Task {
            do {
                let next = try await work()
                state.setStatus(next, of: id)
                if next == .applied || next == .undone { await plan.refresh() }
            } catch {
                state.setStatus(current, of: id)
            }
            state.busyProposal = nil
        }
    }
}
