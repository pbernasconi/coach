import Foundation
import KoboComponents
import UIKit

/// Keeps a message's request alive when Paolo leaves the app while Coach answers: iOS gives a background task some
/// time to finish it. The server finishes the answer either way and pushes it (lift/PUSH.md).
nonisolated struct BackgroundCoachChat: CoachChatting {
    let base: any CoachChatting

    func thread() async throws -> CoachThread { try await base.thread() }

    func reply(to text: String, after history: [CoachMessage]) async throws -> CoachReply {
        let time = await BackgroundTime.begin("Coach reply")
        defer { Task { await time.end() } }
        return try await base.reply(to: text, after: history)
    }

    func replies(to text: String, after history: [CoachMessage]) -> AsyncThrowingStream<CoachReplyEvent, any Error> {
        replies(to: text, files: [], after: history)
    }

    func replies(
        to text: String,
        files: [CoachFile],
        after history: [CoachMessage]
    ) -> AsyncThrowingStream<CoachReplyEvent, any Error> {
        let stream = base.replies(to: text, files: files, after: history)
        return AsyncThrowingStream { continuation in
            let task = Task {
                let time = await BackgroundTime.begin("Coach reply")
                do {
                    for try await event in stream { continuation.yield(event) }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
                await time.end()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    func upload(_ file: ChatPickedFile) async throws -> CoachFile { try await base.upload(file) }

    func fileData(_ id: String) async throws -> Data { try await base.fileData(id) }

    func apply(_ proposalID: String) async throws -> ChatActionStatus { try await base.apply(proposalID) }

    func undo(_ proposalID: String) async throws -> ChatActionStatus { try await base.undo(proposalID) }

    func dismiss(_ proposalID: String) async throws -> ChatActionStatus { try await base.dismiss(proposalID) }

    func decide(_ decision: CoachDecision, on proposalID: String) async throws -> CoachProposalUpdate {
        try await base.decide(decision, on: proposalID)
    }

    func rate(_ messageID: String, _ rating: ChatFeedbackRating?) async throws { try await base.rate(messageID, rating) }

    func threads() async throws -> [CoachThreadSummary] { try await base.threads() }

    func newThread() async throws -> CoachThread { try await base.newThread() }

    func openThread(_ id: String) async throws -> CoachThread { try await base.openThread(id) }
}

/// One UIKit background task, ended once: by the work, or by iOS when the time runs out.
@MainActor
private final class BackgroundTime {
    private var id = UIBackgroundTaskIdentifier.invalid

    static func begin(_ name: String) -> BackgroundTime {
        let time = BackgroundTime()
        time.id = UIApplication.shared.beginBackgroundTask(withName: name) { time.end() }
        return time
    }

    func end() {
        guard id != .invalid else { return }
        UIApplication.shared.endBackgroundTask(id)
        id = .invalid
    }
}

/// Opens Lift's page in iOS Settings.
@MainActor
final class LiveAppSettings: AppSettingsOpening {
    func openAppSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }
}
