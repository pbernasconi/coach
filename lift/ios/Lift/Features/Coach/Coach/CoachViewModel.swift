import Foundation
import KoboComponents
import Observation

/// The Coach tab: sends messages, shows replies and applies the changes Coach proposes (lift/COACH-CHAT.md).
@Observable
final class CoachViewModel {
    private(set) var state = CoachState()
    private let coach: any CoachChatting
    private var replyTask: Task<Void, Never>?

    init(coach: any CoachChatting) {
        self.coach = coach
    }

    /// Nothing to load yet: the conversation starts empty each launch until the server keeps it.
    func run() async {}

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
            return change(id, to: .applied, from: .pending) { try await self.coach.apply(id) }
        case .undoTapped(let id):
            return change(id, to: .pending, from: .applied) { try await self.coach.undo(id) }
        case .dismissTapped(let id):
            setStatus(.dismissed, of: id)
            return nil
        }
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

    /// Applies or undoes a proposal; the card shows the spinner meanwhile and goes back if it fails.
    private func change(
        _ id: String,
        to target: ChatActionStatus,
        from current: ChatActionStatus,
        _ work: @escaping () async throws -> Void
    ) -> Task<Void, Never>? {
        guard state.busyProposal == nil, status(of: id) == current else { return nil }
        state.busyProposal = id
        if target == .applied { setStatus(.applying, of: id) }
        return Task {
            do {
                try await work()
                setStatus(target, of: id)
            } catch {
                setStatus(current, of: id)
            }
            state.busyProposal = nil
        }
    }

    private func append(_ body: CoachMessage.Body) {
        state.messages.append(CoachMessage(id: "m\(state.nextID)", body: body))
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
