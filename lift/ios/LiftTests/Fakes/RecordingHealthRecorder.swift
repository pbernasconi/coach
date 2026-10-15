import Foundation

@testable import Lift

/// A `WorkoutHealthRecording` that records every call, in order, and answers with `statusAnswer`.
@MainActor
final class RecordingHealthRecorder: WorkoutHealthRecording {
    enum Call: Equatable {
        case finished(UUID)
        case allow(UUID)
        case setEnabled(Bool)
        case removed(UUID)
        case restored(UUID)
    }

    /// What `status()` returns.
    var statusAnswer: HealthStatus
    /// What `allow` and `setEnabled` return; `statusAnswer` when nil.
    var answerAfterAsking: HealthStatus?
    private(set) var calls: [Call] = []

    init(status: HealthStatus = .on) {
        statusAnswer = status
    }

    func status() -> HealthStatus { statusAnswer }

    func sessionFinished(_ sessionID: UUID) async { calls.append(.finished(sessionID)) }

    func allow(savingSession sessionID: UUID) async -> HealthStatus {
        calls.append(.allow(sessionID))
        return answerAfterAsking ?? statusAnswer
    }

    func setEnabled(_ isOn: Bool) async -> HealthStatus {
        calls.append(.setEnabled(isOn))
        return answerAfterAsking ?? statusAnswer
    }

    func sessionRemoved(_ sessionID: UUID) async { calls.append(.removed(sessionID)) }

    func sessionRestored(_ sessionID: UUID) async { calls.append(.restored(sessionID)) }
}
