import Foundation
import KoboComponents

/// The top bar's history and new chat, and the thumbs under Coach's replies (lift/APP-API.md, "Coach"). Changes the
/// tab's state through `edit`, which `CoachViewModel` hands it; `stop` ends a reply in progress before the chat changes.
@MainActor
final class CoachThreads {
    private let coach: any CoachChatting
    private let edit: ((inout CoachState) -> Void) -> Void
    private let stop: () -> Void

    init(
        coach: any CoachChatting,
        edit: @escaping ((inout CoachState) -> Void) -> Void,
        stop: @escaping () -> Void
    ) {
        self.coach = coach
        self.edit = edit
        self.stop = stop
    }

    func handle(_ action: CoachAction, in state: CoachState) -> Task<Void, Never>? {
        switch action {
        case .feedbackTapped(let id, let rating): return rate(id, rating, was: state.feedback(of: id))
        case .historyShown(let shown): return shown ? loadHistory() : close()
        case .newChatTapped: return open { try await $0.newThread() }
        case .threadPicked(let id): return open { try await $0.openThread(id) }
        default: return nil
        }
    }

    /// The thumb fills at once and goes back if the server does not take it.
    private func rate(_ id: String, _ rating: ChatFeedbackRating?, was previous: ChatFeedbackRating?) -> Task<Void, Never> {
        edit { $0.setFeedback(rating, of: id) }
        let coach = coach
        return Task {
            do { try await coach.rate(id, rating) } catch { edit { $0.setFeedback(previous, of: id) } }
        }
    }

    private func close() -> Task<Void, Never>? {
        edit { $0.history = .closed }
        return nil
    }

    private func loadHistory() -> Task<Void, Never> {
        edit { $0.history = .loading }
        let coach = coach
        return Task {
            do {
                let threads = try await coach.threads()
                edit { if $0.history.isOpen { $0.history = .loaded(threads) } }
            } catch {
                let words = (error as? CoachChatError)?.message ?? String(localized: "Coach could not load past chats.")
                edit { if $0.history.isOpen { $0.history = .failed(words) } }
            }
        }
    }

    /// A new or past chat replaces the one on screen; the sheet closes.
    private func open(_ load: @escaping (any CoachChatting) async throws -> CoachThread) -> Task<Void, Never> {
        stop()
        edit { $0.history = .closed }
        let coach = coach
        return Task {
            do {
                let thread = try await load(coach)
                edit { state in
                    state.messages = thread.messages
                    state.phase = .idle
                    state.draft = ""
                    state.notice = thread.notice
                    if let name = thread.firstName { state.firstName = name }
                    if !thread.prompts.isEmpty { state.prompts = thread.prompts }
                }
            } catch {
                let words = (error as? CoachChatError)?.message ?? String(localized: "Coach could not open that chat.")
                edit { $0.notice = words }
            }
        }
    }
}
