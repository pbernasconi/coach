import Foundation
import LiftSync

/// The live `Syncing`: the app's `SyncEngine` and the token store its transport reads.
final class LiveSync: Syncing {
    let isConfigured = true
    private let engine: SyncEngine
    private let tokens: any TokenStoring
    private let enrollment: any Enrolling

    init(engine: SyncEngine, tokens: any TokenStoring, enrollment: any Enrolling) {
        self.engine = engine
        self.tokens = tokens
        self.enrollment = enrollment
    }

    @discardableResult
    func syncNow() async -> SyncStatus {
        await engine.syncNow()
    }

    func scheduleSync() async {
        await engine.scheduleSync()
    }

    func statusUpdates() -> AsyncStream<SyncStatus> {
        engine.statusUpdates()
    }

    func setToken(_ token: String?) async throws {
        let trimmed = token?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if trimmed.isEmpty {
            try tokens.remove()
        } else {
            try tokens.save(trimmed)
        }
    }

    func redeem(enrollmentCode: String) async throws {
        try await setToken(try await enrollment.token(for: enrollmentCode))
    }

    func hasToken() async -> Bool {
        guard let token = try? await tokens.token() else { return false }
        return !token.isEmpty
    }
}
