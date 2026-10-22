import Foundation

/// What iOS allows for Lift's notifications.
public enum PushAuthorization: Equatable, Sendable {
    case notDetermined
    case denied
    case authorized
}

/// The system side of push: the permission and the APNs token request. `LivePushSystem` (the app) wraps
/// `UNUserNotificationCenter` and `UIApplication`; tests use a fake.
@MainActor
public protocol PushSystem: AnyObject {
    func authorization() async -> PushAuthorization
    /// Shows the system prompt. True when the person allowed notifications.
    func requestAuthorization() async -> Bool
    /// Asks APNs for the token; it arrives through the app delegate (`tokenReceived`).
    func registerForRemoteNotifications()
}

/// The facts a registration carries besides the token.
public struct PushInstall: Equatable, Sendable {
    public var environment: ApnsEnvironment
    public var topic: String
    public var installId: String
    public var appVersion: String?
    public var deviceName: String?

    public init(
        environment: ApnsEnvironment,
        topic: String,
        installId: String,
        appVersion: String?,
        deviceName: String?
    ) {
        self.environment = environment
        self.topic = topic
        self.installId = installId
        self.appVersion = appVersion
        self.deviceName = deviceName
    }
}

/// Keeps this install's APNs token registered with the coach while sync is connected (lift/PUSH.md).
///
/// - Start: the first launch or foreground with sync connected asks for the permission once (Lift is a personal app
///   whose notices are the point, so it asks straight away), then asks APNs for the token, whatever the answer: the
///   server hears a phone that shows no alerts (`notificationsAuthorized: false`).
/// - Refresh: every later foreground reads the permission again, so turning notifications on or off in iOS Settings is
///   seen at once.
/// - Registration: the token and the permission go to `POST /api/app/push/devices` unless the server already took that
///   same pair in this launch. APNs can rotate the token at any time; a changed token is sent again.
/// - Single flight: one loop takes one signal at a time, so no two sends overlap.
/// - Retry: a send that failed on the network or a `5xx` is sent again after 2, 4, 8, 16 and 32 seconds, then waits for
///   the next foreground. A `401` or `4xx` waits for the next foreground too.
/// - Best effort: no push setup or a failed send means no pushes, never an error on screen.
@MainActor
public final class PushRegistrar {
    private enum Signal {
        case refresh
        case tokenReceived(String)
        case retryDue(Int)
    }

    private struct Registration: Equatable {
        let token: String
        let isAuthorized: Bool
    }

    /// The waits between failed sends in a row; no more retries after the last.
    public static let retryDelays: [Duration] = [.seconds(2), .seconds(4), .seconds(8), .seconds(16), .seconds(32)]

    private let system: any PushSystem
    private let devices: any PushDeviceRegistering
    private let install: PushInstall
    /// Whether sync is connected (a token is stored): without it there is no one to register with.
    private let isConnected: @MainActor () async -> Bool
    private let clock: any Clock<Duration>
    private let signals: AsyncStream<Signal>
    private let continuation: AsyncStream<Signal>.Continuation
    private var hasStarted = false
    private var isAuthorized = false
    private var token: String?
    private var confirmed: Registration?
    private var failures = 0
    /// The newest scheduled retry; an older one that comes due does nothing.
    private var retryID = 0

    public init(
        system: any PushSystem,
        devices: any PushDeviceRegistering,
        install: PushInstall,
        isConnected: @escaping @MainActor () async -> Bool,
        clock: any Clock<Duration>
    ) {
        self.system = system
        self.devices = devices
        self.install = install
        self.isConnected = isConnected
        self.clock = clock
        (signals, continuation) = AsyncStream.makeStream(of: Signal.self)
    }

    /// Launch, foreground, or sync just connected: start, or read the permission again.
    public func refresh() { continuation.yield(.refresh) }

    /// The app delegate's `didRegisterForRemoteNotificationsWithDeviceToken`, as hex.
    public func tokenReceived(_ token: String) { continuation.yield(.tokenReceived(token)) }

    /// Takes the signals for the life of the shell. Start it once.
    public func run() async {
        for await signal in signals {
            switch signal {
            case .refresh: await refreshNow()
            case .tokenReceived(let token): await receive(token)
            case .retryDue(let id) where id == retryID: await sendIfNeeded()
            case .retryDue: break
            }
        }
    }

    private func refreshNow() async {
        guard await isConnected() else { return }
        var authorization = await system.authorization()
        if !hasStarted, authorization == .notDetermined {
            authorization = await system.requestAuthorization() ? .authorized : .denied
        }
        isAuthorized = authorization == .authorized
        if !hasStarted {
            hasStarted = true
            system.registerForRemoteNotifications()
        }
        failures = 0
        await sendIfNeeded()
    }

    private func receive(_ token: String) async {
        self.token = token
        failures = 0
        await sendIfNeeded()
    }

    private func sendIfNeeded() async {
        guard hasStarted, let token else { return }
        let registration = Registration(token: token, isAuthorized: isAuthorized)
        guard registration != confirmed else { return }
        do {
            try await devices.register(
                PushDeviceRegistration(
                    token: token,
                    environment: install.environment,
                    topic: install.topic,
                    installId: install.installId,
                    appVersion: install.appVersion,
                    deviceName: install.deviceName,
                    notificationsAuthorized: isAuthorized
                )
            )
            confirmed = registration
            failures = 0
        } catch SyncTransportError.retryable, SyncTransportError.invalidResponse {
            scheduleRetry()
        } catch {
            SyncLog.pushRegistrationFailed(error)
        }
    }

    private func scheduleRetry() {
        failures += 1
        guard Self.retryDelays.indices.contains(failures - 1) else { return }
        let delay = Self.retryDelays[failures - 1]
        retryID += 1
        let id = retryID
        Task { [clock, continuation] in
            try? await clock.sleep(for: delay)
            continuation.yield(.retryDue(id))
        }
    }
}
