import Foundation
import LiftCore
import LiftStore
import LiftSync
import LiftTesting
import Testing

/// A real server 5xx: `lift/scripts/sync-e2e.sh` stops Postgres, so the coach server answers 500, and runs this
/// suite with `LIFT_SYNC_E2E_OUTAGE=down`; then it starts Postgres again and runs it with `up`. The device's
/// database lives in `LIFT_SYNC_E2E_STATE_DIR`, so the second phase is the same phone after a relaunch.
@Suite(
    .serialized,
    .enabled(if: E2EConfig.isEnabled && E2EConfig.outagePhase != nil, "set LIFT_SYNC_E2E_URL and LIFT_SYNC_E2E_OUTAGE")
)
struct SyncOutageEndToEndTests {
    @Test func aServerErrorKeepsTheOutboxUntilTheServerIsBack() async throws {
        let directory = try #require(E2EConfig.stateDirectory, "LIFT_SYNC_E2E_STATE_DIR")
        let marker = directory.appending(path: "outage-set-id")
        switch E2EConfig.outagePhase {
        case "down":
            let device = try E2EDevice(directory: directory.appending(path: "phone"), now: .e2e())
            let ids = try await device.writeWorkout()
            let pending = try await device.pendingCount()
            let status = await device.engine.syncNow()
            #expect(status.phase == .failed(.offline))  // 500 from the server: retryable
            #expect(try await device.pendingCount() == pending)
            await #expect(throws: SyncTransportError.retryable(status: 500)) {
                try await device.transport.pull(cursor: nil, limit: 1)
            }
            try Data(try #require(ids.liveSet).uuidString.utf8).write(to: marker)
        case "up":
            let text = try #require(String(bytes: try Data(contentsOf: marker), encoding: .utf8))
            let setID = try #require(UUID(uuidString: text))
            let device = try E2EDevice(directory: directory.appending(path: "phone"), now: .e2e(offsetSeconds: 60))
            #expect(try await device.pendingCount() > 0)
            #expect(await device.engine.syncNow().phase == .idle)
            #expect(try await device.pendingCount() == 0)
            let other = try E2EDevice(now: .e2e())
            defer { other.remove() }
            #expect(await other.engine.syncNow().phase == .idle)
            let mine = try #require(try await device.set(setID))
            #expect(try await other.set(setID) == mine)
        default:
            Issue.record("LIFT_SYNC_E2E_OUTAGE must be down or up")
        }
    }
}
