import Foundation

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// The APNs host a device token belongs to: the build's signing decides (lift/PUSH.md). An Xcode build holds sandbox
/// tokens; TestFlight and the App Store hold production tokens.
public enum ApnsEnvironment: String, Codable, Equatable, Sendable {
    case sandbox
    case production
}

/// `POST /api/app/push/devices` (lift/PUSH.md): this install's APNs token and what the phone allows.
public struct PushDeviceRegistration: Encodable, Equatable, Sendable {
    /// The APNs device token as lower-case hex.
    public var token: String
    public var environment: ApnsEnvironment
    /// The app's bundle id, sent as `apns-topic`.
    public var topic: String
    /// The install's own id: a new token from the same install replaces the old one on the server.
    public var installId: String
    public var appVersion: String?
    public var deviceName: String?
    /// False when Lift's notifications are off in iOS Settings: APNs still takes the push, iOS hides it.
    public var notificationsAuthorized: Bool

    public init(
        token: String,
        environment: ApnsEnvironment,
        topic: String,
        installId: String,
        appVersion: String?,
        deviceName: String?,
        notificationsAuthorized: Bool
    ) {
        self.token = token
        self.environment = environment
        self.topic = topic
        self.installId = installId
        self.appVersion = appVersion
        self.deviceName = deviceName
        self.notificationsAuthorized = notificationsAuthorized
    }
}

/// The push endpoints of the coach (lift/PUSH.md). `URLSessionPushDevices` is the live one; tests use a fake. Each
/// call throws `SyncTransportError` (`missingToken` when sync is not connected: nothing was sent) or
/// `CancellationError`.
public protocol PushDeviceRegistering: Sendable {
    /// Registers or refreshes this install's token. Safe to repeat.
    func register(_ registration: PushDeviceRegistration) async throws
    /// Turns the token off on the server, as when sync is disconnected.
    func unregister(token: String) async throws
    /// A tapped notice, by the `notificationId` its push carried.
    func opened(notificationID: String) async throws
}

/// The live client: an injected `URLSession` (never `.shared`), the coach's origin and the sync token.
public struct URLSessionPushDevices: PushDeviceRegistering {
    private let session: URLSession
    private let baseURL: URL
    private let tokens: any TokenProvider

    public init(session: URLSession, baseURL: URL, tokens: any TokenProvider) {
        self.session = session
        self.baseURL = baseURL
        self.tokens = tokens
    }

    @concurrent
    public func register(_ registration: PushDeviceRegistration) async throws {
        try await send("POST", PushDeviceRequest.devicesPath, registration)
    }

    @concurrent
    public func unregister(token: String) async throws {
        try await send("DELETE", PushDeviceRequest.devicesPath, ["token": token])
    }

    @concurrent
    public func opened(notificationID: String) async throws {
        try await send("POST", PushDeviceRequest.openedPath, ["notificationId": notificationID])
    }

    private func send(_ method: String, _ path: String, _ body: some Encodable & Sendable) async throws {
        guard let token = try await TokenRead.token(from: tokens) else { throw SyncTransportError.missingToken }
        let request = try PushDeviceRequest.make(baseURL: baseURL, path: path, method: method, body: body, token: token)
        let result: (Data, URLResponse)
        do {
            result = try await session.data(for: request)
        } catch {
            throw SyncResponseMapper.transportError(error)
        }
        guard let http = result.1 as? HTTPURLResponse else { throw SyncTransportError.invalidResponse }
        if let error = SyncTransportError.forStatus(http.statusCode) { throw error }
    }
}

/// Builds a push endpoint request. Pure, so tests check the URL, headers and body without a network.
public enum PushDeviceRequest {
    public static let devicesPath = "api/app/push/devices"
    public static let openedPath = "api/app/push/opened"

    public static func make(
        baseURL: URL,
        path: String,
        method: String,
        body: some Encodable,
        token: String
    ) throws -> URLRequest {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.cachePolicy = .reloadIgnoringLocalCacheData
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        request.httpBody = try encoder.encode(body)
        return request
    }
}
