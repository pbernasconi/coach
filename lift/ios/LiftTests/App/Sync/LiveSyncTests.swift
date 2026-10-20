import Foundation
import LiftStore
import LiftSync
import LiftTesting
import Synchronization
import Testing

@testable import Lift

/// `LiveSync` over a real `SyncEngine` and an in-memory database; the token store stands in for the Keychain.
@MainActor
@Suite struct LiveSyncTests {
    let store: TestStore
    let tokens: InMemoryTokenStore
    let enrollment = FakeEnrollment()
    let transport: TokenCheckingTransport
    let live: LiveSync

    init() throws {
        let store = try TestStore.make()
        let tokens = InMemoryTokenStore()
        let transport = TokenCheckingTransport(tokens: tokens)
        let engine = SyncEngine(
            outbox: store.outbox,
            state: LiveSyncStateRepository(database: store.database) { store.ids.next() },
            transport: transport,
            now: { store.now() },
            clock: ImmediateClock()
        )
        self.store = store
        self.tokens = tokens
        self.transport = transport
        live = LiveSync(engine: engine, tokens: tokens, enrollment: enrollment)
    }

    @Test func isConfigured() {
        #expect(live.isConfigured)
    }

    @Test func withoutATokenSyncIsNotSetUp() async {
        #expect(await live.hasToken() == false)

        let status = await live.syncNow()

        #expect(status.phase == .failed(.notConfigured))
        #expect(transport.tokensSeen.isEmpty)
    }

    @Test func aSavedTokenIsTrimmedAndSent() async throws {
        try await live.setToken("  made-up-token \n")

        let status = await live.syncNow()

        #expect(tokens.stored == "made-up-token")
        #expect(await live.hasToken())
        #expect(status == SyncStatus(phase: .idle, lastSyncedAt: store.now()))
        #expect(transport.tokensSeen == ["made-up-token"])
    }

    @Test(arguments: [nil, "", "  \n"])
    func aBlankTokenRemovesTheStoredOne(token: String?) async throws {
        try await live.setToken("made-up-token")

        try await live.setToken(token)

        #expect(tokens.stored == nil)
        #expect(await live.hasToken() == false)
    }

    @Test func anEnrollmentCodeIsTradedForTheToken() async throws {
        await enrollment.set(tokens: ["one-time-code": "made-up-token"])

        try await live.redeem(enrollmentCode: "one-time-code")

        #expect(tokens.stored == "made-up-token")
        #expect(await enrollment.codes == ["one-time-code"])
    }

    @Test func aRefusedCodeKeepsTheOldToken() async throws {
        try await live.setToken("old-token")

        await #expect(throws: (any Error).self) { try await live.redeem(enrollmentCode: "used-code") }

        #expect(tokens.stored == "old-token")
    }

    @Test func statusUpdatesStartWithTheCurrentStatus() async {
        var updates = live.statusUpdates().makeAsyncIterator()

        #expect(await updates.next() == .initial)
    }
}

/// `DisabledSync`: demo data and builds without a server never sync.
@MainActor
@Suite struct DisabledSyncTests {
    let sync = DisabledSync()

    @Test func neverSyncs() async {
        #expect(sync.isConfigured == false)
        #expect(await sync.syncNow() == DisabledSync.status)
        #expect(DisabledSync.status.phase == .failed(.notConfigured))
        #expect(await sync.hasToken() == false)
    }

    @Test func statusUpdatesSayNotSetUpThenFinish() async {
        var seen: [SyncStatus] = []
        for await status in sync.statusUpdates() { seen.append(status) }

        #expect(seen == [DisabledSync.status])
    }

    @Test func savingATokenFails() async {
        await #expect(throws: (any Error).self) { try await sync.setToken("made-up-token") }
    }
}

/// A transport that needs a token like the live one, records which token it saw, and accepts everything.
nonisolated final class TokenCheckingTransport: SyncTransport {
    private let tokens: any TokenProvider
    private let seen = Mutex<[String]>([])

    init(tokens: any TokenProvider) {
        self.tokens = tokens
    }

    var tokensSeen: [String] { seen.withLock { $0 } }

    func push(_ body: PushRequest) async throws -> PushResponse {
        try await record()
        return PushResponse(accepted: body.changes.map(\.idempotencyKey))
    }

    func pull(cursor: String?, limit _: Int) async throws -> PullResponse {
        try await record()
        return PullResponse(changes: [], cursor: cursor ?? "0", hasMore: false)
    }

    private func record() async throws {
        guard let token = try await tokens.token(), !token.isEmpty else { throw SyncTransportError.missingToken }
        seen.withLock { $0.append(token) }
    }
}
