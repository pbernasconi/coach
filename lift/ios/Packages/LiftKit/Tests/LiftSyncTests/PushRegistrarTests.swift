import Foundation
import Synchronization
import Testing

@testable import LiftSync

@MainActor
private final class FakePushSystem: PushSystem {
    var status: PushAuthorization
    var allows: Bool
    private(set) var prompts = 0
    private(set) var tokenRequests = 0

    init(status: PushAuthorization, allows: Bool = true) {
        self.status = status
        self.allows = allows
    }

    func authorization() async -> PushAuthorization { status }

    func requestAuthorization() async -> Bool {
        prompts += 1
        status = allows ? .authorized : .denied
        return allows
    }

    func registerForRemoteNotifications() { tokenRequests += 1 }
}

private final class FakePushDevices: PushDeviceRegistering {
    private let state = Mutex<(sent: [PushDeviceRegistration], failures: [any Error])>(([], []))

    var sent: [PushDeviceRegistration] { state.withLock { $0.sent } }

    /// The next sends fail with these errors, in order.
    func fail(with errors: [any Error]) { state.withLock { $0.failures = errors } }

    func register(_ registration: PushDeviceRegistration) async throws {
        let failure: (any Error)? = state.withLock { state in
            state.sent.append(registration)
            return state.failures.isEmpty ? nil : state.failures.removeFirst()
        }
        if let failure { throw failure }
    }

    func unregister(token _: String) async throws {}
    func opened(notificationID _: String) async throws {}
}

@MainActor
@Suite struct PushRegistrarTests {
    private let install = PushInstall(
        environment: .sandbox,
        topic: "com.example.lift",
        installId: "I1",
        appVersion: "1.0 (1)",
        deviceName: "iPhone"
    )

    private func registrar(
        _ system: FakePushSystem,
        _ devices: FakePushDevices,
        connected: Bool = true,
        clock: TestClock = TestClock()
    ) -> PushRegistrar {
        let registrar = PushRegistrar(
            system: system,
            devices: devices,
            install: install,
            isConnected: { connected },
            clock: clock
        )
        Task { await registrar.run() }
        return registrar
    }

    @Test func firstLaunchAsksOnceThenRegistersTheToken() async {
        let system = FakePushSystem(status: .notDetermined)
        let devices = FakePushDevices()
        let registrar = registrar(system, devices)
        registrar.refresh()
        registrar.tokenReceived("ab12")
        await eventually { devices.sent.count == 1 }
        #expect(system.prompts == 1)
        #expect(system.tokenRequests == 1)
        #expect(devices.sent.first?.token == "ab12")
        #expect(devices.sent.first?.notificationsAuthorized == true)
        #expect(devices.sent.first?.environment == .sandbox)
        #expect(devices.sent.first?.installId == "I1")
    }

    @Test func theSameTokenAndPermissionAreSentOnce() async {
        let system = FakePushSystem(status: .authorized)
        let devices = FakePushDevices()
        let registrar = registrar(system, devices)
        registrar.refresh()
        registrar.tokenReceived("ab12")
        registrar.tokenReceived("ab12")
        registrar.refresh()
        registrar.tokenReceived("cd34")
        await eventually { devices.sent.count == 2 }
        for _ in 0..<50 { await Task.yield() }
        #expect(devices.sent.map(\.token) == ["ab12", "cd34"])
        #expect(system.prompts == 0)
        #expect(system.tokenRequests == 1)
    }

    @Test func turningNotificationsOffInSettingsIsSentOnTheNextForeground() async {
        let system = FakePushSystem(status: .authorized)
        let devices = FakePushDevices()
        let registrar = registrar(system, devices)
        registrar.refresh()
        registrar.tokenReceived("ab12")
        await eventually { devices.sent.count == 1 }
        system.status = .denied
        registrar.refresh()
        await eventually { devices.sent.count == 2 }
        #expect(devices.sent.map(\.notificationsAuthorized) == [true, false])
    }

    @Test func aDeniedPromptStillRegistersSoTheServerKnows() async {
        let system = FakePushSystem(status: .notDetermined, allows: false)
        let devices = FakePushDevices()
        let registrar = registrar(system, devices)
        registrar.refresh()
        registrar.tokenReceived("ab12")
        await eventually { devices.sent.count == 1 }
        #expect(devices.sent.first?.notificationsAuthorized == false)
    }

    @Test func withoutSyncNothingIsAskedOrSent() async {
        let system = FakePushSystem(status: .notDetermined)
        let devices = FakePushDevices()
        let registrar = registrar(system, devices, connected: false)
        registrar.refresh()
        registrar.tokenReceived("ab12")
        for _ in 0..<200 { await Task.yield() }
        #expect(system.prompts == 0)
        #expect(system.tokenRequests == 0)
        #expect(devices.sent.isEmpty)
    }

    @Test func aFailedSendIsRetriedAfterTheBackoff() async {
        let system = FakePushSystem(status: .authorized)
        let devices = FakePushDevices()
        let clock = TestClock()
        devices.fail(with: [SyncTransportError.retryable(status: 503), SyncTransportError.retryable(status: nil)])
        let registrar = registrar(system, devices, clock: clock)
        registrar.refresh()
        registrar.tokenReceived("ab12")
        await eventually { clock.sleeperCount == 1 }
        #expect(devices.sent.count == 1)
        clock.advance(by: .seconds(2))
        await eventually { clock.sleeperCount == 1 && devices.sent.count == 2 }
        clock.advance(by: .seconds(4))
        await eventually { devices.sent.count == 3 }
        for _ in 0..<50 { await Task.yield() }
        #expect(devices.sent.count == 3)
        #expect(clock.sleeperCount == 0)
    }

    @Test func aRefusedTokenIsNotRetried() async {
        let system = FakePushSystem(status: .authorized)
        let devices = FakePushDevices()
        let clock = TestClock()
        devices.fail(with: [SyncTransportError.unauthorized])
        let registrar = registrar(system, devices, clock: clock)
        registrar.refresh()
        registrar.tokenReceived("ab12")
        await eventually { devices.sent.count == 1 }
        for _ in 0..<50 { await Task.yield() }
        #expect(clock.sleeperCount == 0)
        registrar.refresh()
        await eventually { devices.sent.count == 2 }
    }
}
