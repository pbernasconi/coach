import Foundation
import GRDB
import LiftCore
import LiftStore
import LiftSync
import LiftTesting
import Synchronization

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// Settings for the opt-in end-to-end suites, from the environment (`lift/scripts/sync-e2e.sh` sets them).
/// Unset `LIFT_SYNC_E2E_URL` and the suites are skipped, so `swift test` never needs a server.
enum E2EConfig {
    private static var environment: [String: String] { ProcessInfo.processInfo.environment }

    /// The coach web app's origin, for example `http://127.0.0.1:3999`.
    static var baseURL: URL? {
        environment["LIFT_SYNC_E2E_URL"].flatMap { $0.isEmpty ? nil : URL(string: $0) }
    }

    static var isEnabled: Bool { baseURL != nil }

    /// The server's `LIFT_SYNC_TOKEN`, generated per run by the script.
    static var token: String? { environment["LIFT_SYNC_E2E_TOKEN"] }

    /// `down` while the script has stopped Postgres, `up` once it is back. Unset skips the outage suite.
    static var outagePhase: String? { environment["LIFT_SYNC_E2E_OUTAGE"] }

    /// A directory that survives between the outage phases (the device's on-disk database lives there).
    static var stateDirectory: URL? {
        environment["LIFT_SYNC_E2E_STATE_DIR"].map { URL(fileURLWithPath: $0, isDirectory: true) }
    }
}

/// The live transport, recording what went over the wire so tests can check batching and paging.
final class RecordingTransport: SyncTransport {
    private let live: URLSessionSyncTransport
    private let state = Mutex(Log())

    struct Log {
        var pushSizes: [Int] = []
        var pulls: [(cursor: String?, count: Int, hasMore: Bool)] = []
    }

    init(baseURL: URL, token: String?) {
        live = URLSessionSyncTransport(
            session: URLSession(configuration: .ephemeral),
            baseURL: baseURL,
            tokens: StaticTokenProvider(token)
        )
    }

    var log: Log { state.withLock { $0 } }

    func reset() { state.withLock { $0 = Log() } }

    func push(_ body: PushRequest) async throws -> PushResponse {
        state.withLock { $0.pushSizes.append(body.changes.count) }
        return try await live.push(body)
    }

    func pull(cursor: String?, limit: Int) async throws -> PullResponse {
        let response = try await live.pull(cursor: cursor, limit: limit)
        state.withLock { $0.pulls.append((cursor, response.changes.count, response.hasMore)) }
        return response
    }
}

/// One phone: the real LiftStore on a temporary on-disk database, the real `SyncEngine` and the live
/// `URLSessionSyncTransport` against the server. Ids are random so runs never collide on a shared server; the
/// clock is manual so last-writer-wins is decided by the test, not by timing.
struct E2EDevice {
    let directory: URL
    let database: LiftDatabase
    let now: ManualNow
    let exercises: LiveExerciseRepository
    let sessions: LiveSessionRepository
    let sets: LiveSetRepository
    let templates: LiveTemplateRepository
    let plans: LiveWorkoutPlanRepository
    let outbox: LiveOutboxRepository
    let state: LiveSyncStateRepository
    let transport: RecordingTransport
    let engine: SyncEngine

    /// `directory` holds `lift.sqlite`; pass the same one again to reopen a device, as after a relaunch.
    init(directory: URL? = nil, now: ManualNow, token: String? = E2EConfig.token) throws {
        let baseURL = try E2EDevice.requireBaseURL()
        let directory =
            directory
            ?? FileManager.default.temporaryDirectory.appending(path: "lift-e2e-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        self.directory = directory
        self.now = now
        database = try LiftDatabase.onDisk(at: directory.appending(path: "lift.sqlite"))
        let clock: @Sendable () -> Date = { now() }
        let makeID: @Sendable () -> UUID = { UUID() }
        exercises = LiveExerciseRepository(database: database, now: clock, makeID: makeID)
        sessions = LiveSessionRepository(database: database, now: clock, makeID: makeID)
        sets = LiveSetRepository(database: database, now: clock, makeID: makeID)
        templates = LiveTemplateRepository(database: database, now: clock, makeID: makeID)
        plans = LiveWorkoutPlanRepository(database: database, now: clock, makeID: makeID)
        outbox = LiveOutboxRepository(database: database)
        state = LiveSyncStateRepository(database: database, makeID: makeID)
        transport = RecordingTransport(baseURL: baseURL, token: token)
        engine = SyncEngine(
            outbox: outbox,
            state: state,
            transport: transport,
            now: clock,
            clock: ContinuousClock(),
            debounce: .milliseconds(10)
        )
    }

    static func requireBaseURL() throws -> URL {
        guard let url = E2EConfig.baseURL else { throw E2EError.notConfigured("LIFT_SYNC_E2E_URL") }
        return url
    }

    func pendingCount() async throws -> Int {
        try await outbox.pending(limit: 100_000).count
    }

    /// Every column of the rows with `ids` in `table`, keyed by id. Compared across devices for "identical rows".
    func rows(_ table: String, ids: some Collection<UUID>) async throws -> [UUID: [String: DatabaseValue]] {
        let ids = Array(ids)
        return try await database.writer.read { db in
            var result: [UUID: [String: DatabaseValue]] = [:]
            for id in ids {
                guard let row = try Row.fetchOne(db, sql: "SELECT * FROM \(table) WHERE id = ?", arguments: [id])
                else { continue }
                var columns: [String: DatabaseValue] = [:]
                for (column, value) in row { columns[column] = value }
                result[id] = columns
            }
            return result
        }
    }

    /// Every synced row this device holds, by table, for the ids in `ids`.
    func snapshot(_ ids: E2EIDs) async throws -> E2ESnapshot {
        E2ESnapshot(
            exercises: try await rows("exercise", ids: ids.exercises),
            sessions: try await rows("session", ids: ids.sessions),
            sessionExercises: try await rows("sessionExercise", ids: ids.sessionExercises),
            sets: try await rows("workoutSet", ids: ids.sets),
            templates: try await rows("template", ids: ids.templates),
            templateExercises: try await rows("templateExercise", ids: ids.templateExercises)
        )
    }

    /// The ids of every slot and set under `sessionID`, deleted ones included.
    func children(ofSession sessionID: UUID) async throws -> (slots: Set<UUID>, sets: Set<UUID>) {
        try await database.writer.read { db in
            let slots = try UUID.fetchAll(
                db,
                sql: "SELECT id FROM sessionExercise WHERE sessionID = ?",
                arguments: [sessionID]
            )
            let sets = try UUID.fetchAll(
                db,
                sql:
                    "SELECT workoutSet.id FROM workoutSet JOIN sessionExercise ON sessionExercise.id = sessionExerciseID "
                    + "WHERE sessionExercise.sessionID = ?",
                arguments: [sessionID]
            )
            return (Set(slots), Set(sets))
        }
    }

    func set(_ id: UUID) async throws -> SetRecord? {
        try await database.writer.read { db in try SetRecord.fetchOne(db, key: id) }
    }

    func remove() {
        try? FileManager.default.removeItem(at: directory)
    }
}

enum E2EError: Error, CustomStringConvertible {
    case notConfigured(String)

    var description: String {
        switch self {
        case .notConfigured(let name): "\(name) is not set (run lift/scripts/sync-e2e.sh)"
        }
    }
}

extension ManualNow {
    /// A clock for one end-to-end scenario: now, rounded down to the second, plus 123 ms, so every stamp carries
    /// milliseconds that must survive the round trip.
    static func e2e(offsetSeconds: TimeInterval = 0) -> ManualNow {
        let whole = Date().timeIntervalSince1970.rounded(.down)
        return ManualNow(Date(timeIntervalSince1970: whole + 0.123 + offsetSeconds))
    }
}
