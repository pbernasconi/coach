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
    private let clock: any Clock<Duration>
    private let settings: any AppSettingsOpening
    private let presence: CoachPresence
    @ObservationIgnored private var uploads: CoachUploads?
    @ObservationIgnored private var threads: CoachThreads?
    private var replyTask: Task<Void, Never>?
    private var pollTask: Task<Void, Never>?
    @ObservationIgnored private var microphone: CoachMicrophone?

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
        self.clock = clock
        self.settings = settings
        self.presence = presence
        uploads = CoachUploads(coach: coach) { [weak self] change in self.map { change(&$0.state) } }
        microphone = CoachMicrophone(
            dictation: CoachDictation(speech: speech, clock: clock),
            read: { [weak self] in self?.state ?? CoachState() },
            edit: { [weak self] change in self.map { change(&$0.state) } },
            send: { [weak self] in self?.send(.sendTapped) }
        )
        threads = CoachThreads(
            coach: coach,
            edit: { [weak self] change in self.map { change(&$0.state) } },
            stop: { [weak self] in self?.stopReply() }
        )
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
            return sendDraft()
        case .retryTapped:
            guard let text = state.lastMessage, !state.isResponding else { return nil }
            return ask(text, files: [])
        case .stopTapped:
            stopReply()
        case .applyTapped(let id):
            return change(id, from: .pending, showing: .applying) { try await self.coach.apply(id) }
        case .undoTapped(let id):
            return change(id, from: .applied, showing: nil) { try await self.coach.undo(id) }
        case .dismissTapped(let id):
            return change(id, from: .pending, showing: nil) { try await self.coach.dismiss(id) }
        case .quickReplyTapped(let text):
            state.draft = text
            return send(.sendTapped)
        case .questionsAnswered(let answers):
            let text = CoachQuestionText.message(state.openQuestions, answers: answers)
            guard !text.isEmpty else { return nil }
            state.draft = text
            return send(.sendTapped)
        case .workoutOpened, .exerciseOpened, .weekOpened, .todayOpened, .mediaNeeded, .settingsTapped, .breakdownOpened:
            return card(action)
        case .feedbackTapped, .historyShown, .newChatTapped, .threadPicked:
            return threads?.handle(action, in: state)
        case .micTapped, .micHoldBegan, .micHoldEnded, .voiceSettingsTapped, .shown, .sceneActive:
            return device(action)
        case .attachShown, .filesPicked, .attachmentRemoved, .attachmentRetried, .filePreviewNeeded:
            return uploads?.handle(action, in: state)
        }
        return nil
    }

    /// Ends the reply in progress here (the server may still finish it).
    private func stopReply() {
        for task in [replyTask, pollTask] { task?.cancel() }
        (replyTask, pollTask) = (nil, nil)
        state.phase = .idle
    }

    /// Sends the draft with its photos and files (once all have uploaded); a message can be photos alone.
    private func sendDraft() -> Task<Void, Never>? {
        guard state.canSend, !state.isResponding else { return nil }
        let text = state.draft.trimmingCharacters(in: .whitespacesAndNewlines)
        if state.voice.isListening { microphone?.run(state.voice.backgrounded()) }
        let files = state.attachments.compactMap { state.uploaded[$0.id] }
        for item in state.attachments {  // the sent tile shows the picked photo at once
            if let file = state.uploaded[item.id] { state.previews[file.id] = state.previews[item.id] }
        }
        state.draft = ""
        state.attachments = []
        state.uploaded = [:]
        uploads?.sent()
        state.append(.mine(text), files: files)
        return ask(text, files: files)
    }

    /// The microphone, and the tab or the app coming and going.
    private func device(_ action: CoachAction) -> Task<Void, Never>? {
        switch action {
        case .micTapped: return microphone?.run(state.voice.tapped())
        case .micHoldBegan: return microphone?.run(state.voice.holdBegan())
        case .micHoldEnded: return microphone?.run(state.voice.holdEnded())
        case .voiceSettingsTapped: settings.openAppSettings()
        case .shown(let isShown):
            presence.isShown = isShown
            if !isShown { microphone?.run(state.voice.backgrounded()) }
        case .sceneActive(let isActive):
            guard isActive else { return microphone?.run(state.voice.backgrounded()) }
            return Task { await run() }
        default: break
        }
        return nil
    }

    /// The server's conversation replaces the one on screen, unless a reply is on its way here (it brings its own).
    private func take(_ thread: CoachThread) {
        if !thread.prompts.isEmpty { state.prompts = thread.prompts }
        if let name = thread.firstName { state.firstName = name }
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

    /// A card's actions (open its page, or load its picture), and the top bar's gear.
    private func card(_ action: CoachAction) -> Task<Void, Never>? {
        switch action {
        case .workoutOpened(let id): router.open(.plannedWorkout(id))
        case .exerciseOpened(let key): router.open(.liftExercise(key))
        case .weekOpened, .breakdownOpened("plan"): tabs.show(.week)
        case .breakdownOpened("lift"): tabs.show(.lift)
        case .todayOpened, .breakdownOpened: tabs.show(.today)
        case .settingsTapped: tabs.show(.settings)
        case .mediaNeeded(let url):
            guard state.media[url] == nil else { return nil }
            state.media[url] = .loading
            let loader = mediaLoader
            return Task { state.media[url] = await MediaImage.load(url, with: loader) }
        default: break
        }
        return nil
    }

    private func ask(_ text: String, files: [CoachFile]) -> Task<Void, Never> {
        state.phase = .waiting
        let history = state.messages
        let task = Task {
            do {
                for try await event in coach.replies(to: text, files: files, after: history) {
                    guard !Task.isCancelled else { return }
                    switch event {
                    case .progress(let progress): state.phase = .answering(progress)
                    case .reply(let reply): state.receive(reply)
                    }
                }
                replyTask = nil
            } catch {
                guard !Task.isCancelled, !(error is CancellationError) else { return }
                state.phase = .failed(
                    (error as? CoachChatError)?.message ?? "Coach could not answer. Check your connection."
                )
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
