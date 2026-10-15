import Foundation

/// The one error type (ERR-1). Code branches on `kind`, never on message text.
public struct AppError: Error, Equatable, Sendable {
    public enum Kind: Equatable, Sendable {
        case offline, unauthorized, notFound, conflict, invalidInput, server, decoding, unknown
    }

    public let kind: Kind
    /// For logs only; never shown to the user.
    public let detail: String?

    public init(_ kind: Kind, detail: String? = nil) {
        self.kind = kind
        self.detail = detail
    }
}
