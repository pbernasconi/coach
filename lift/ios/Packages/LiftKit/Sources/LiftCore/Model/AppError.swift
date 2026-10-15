import Foundation

/// The one error type (ERR-1). Code branches on `kind`, never on message text.
public struct AppError: Error, Equatable, Sendable {
    public enum Kind: Int, Equatable, Sendable, CaseIterable {
        case offline, unauthorized, notFound, conflict, invalidInput, server, decoding, unknown
    }

    public let kind: Kind
    /// For logs only; never shown to the user.
    public let detail: String?

    public init(_ kind: Kind, detail: String? = nil) {
        self.kind = kind
        self.detail = detail
    }

    /// The kind of any thrown error: an `AppError`'s own kind, otherwise `.unknown`.
    ///
    /// Reads the bridged `NSError` domain and code instead of casting with `as? AppError`. A unit-test bundle
    /// links its own copy of LiftCore next to the app's, and a cast between the two copies fails; the domain and
    /// code are plain values that match whichever copy threw.
    public static func kind(of error: any Error) -> Kind {
        let bridged = error as NSError
        guard bridged.domain == errorDomain else { return .unknown }
        return Kind(rawValue: bridged.code) ?? .unknown
    }
}

extension AppError: CustomNSError {
    public static let errorDomain = "LiftCore.AppError"
    public var errorCode: Int { kind.rawValue }
}
