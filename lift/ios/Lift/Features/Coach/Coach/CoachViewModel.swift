import Foundation
import KoboComponents
import Observation

/// The Coach tab: sends messages, shows replies and applies the changes Coach proposes (lift/COACH-CHAT.md).
@Observable
final class CoachViewModel {
    private(set) var state = CoachState()
    private let coach: any CoachChatting
    private let plan: any CoachPlanProviding
    private let router: any Navigating
    private let tabs: any TabSwitching
    private let mediaLoader: any ExerciseMediaLoader
    private var replyTask: Task<Void, Never>?

    init(
        coach: any CoachChatting,
        plan: any CoachPlanProviding,
        router: any Navigating,
        tabs: any TabSwitching,
        mediaLoader: any ExerciseMediaLoader
    ) {
        self.coach = coach
        self.plan = plan
        self.router = router
        self.tabs = tabs
        self.mediaLoader = mediaLoader
    }

    /// Reads the open conversation. A failure leaves the tab empty with the reason as its notice.
    func run() async {
        do {
            let thread = try await coach.thread()
            if state.messages.isEmpty { state.messages = thread.messages }
            if !thread.prompts.isEmpty { state.prompts = thread.prompts }
            state.notice = thread.notice
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
            return nil
        case .promptPicked(let prompt):
            state.draft = prompt.title
            return nil
        case .sendTapped:
            let text = state.draft.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty, !state.isResponding else { return nil }
            state.draft = ""
            append(.mine(text))
            return ask(text)
        case .retryTapped:
            guard let text = state.lastMessage, !state.isResponding else { return nil }
            return ask(text)
        case .stopTapped:
            replyTask?.cancel()
            replyTask = nil
            state.phase = .idle
            return nil
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
                let reply = try await coach.reply(to: text, after: history)
                guard !Task.isCancelled else { return }
                if reply.proposal != nil { supersedeOpenProposals() }
                append(.coach(reply))
                state.phase = .idle
            } catch is CancellationError {
                return
            } catch let error as CoachChatError {
                if !Task.isCancelled { state.phase = .failed(error.message) }
            } catch {
                if !Task.isCancelled { state.phase = .failed("Coach could not answer. Check your connection.") }
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
        guard state.busyProposal == nil, status(of: id) == current else { return nil }
        state.busyProposal = id
        if let busy { setStatus(busy, of: id) }
        return Task {
            do {
                let next = try await work()
                setStatus(next, of: id)
                if next == .applied || next == .undone { await plan.refresh() }
            } catch {
                setStatus(current, of: id)
            }
            state.busyProposal = nil
        }
    }

    private func append(_ body: CoachMessage.Body) {
        state.messages.append(CoachMessage(id: "local-\(state.nextID)", body: body))
        state.nextID += 1
    }

    private func status(of id: String) -> ChatActionStatus? {
        state.messages.lazy.compactMap(\.proposal).first { $0.id == id }?.status
    }

    private func setStatus(_ status: ChatActionStatus, of id: String) {
        for index in state.messages.indices {
            guard case .coach(var reply) = state.messages[index].body, reply.proposal?.id == id else { continue }
            reply.proposal?.status = status
            state.messages[index].body = .coach(reply)
        }
    }

    /// A new proposal replaces the ones still waiting.
    private func supersedeOpenProposals() {
        for proposal in state.messages.compactMap(\.proposal) where proposal.status == .pending {
            setStatus(.superseded, of: proposal.id)
        }
    }
}
