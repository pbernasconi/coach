import Foundation
import LiftCore

/// What the sync engine is doing, for a Settings row or a badge.
public struct SyncStatus: Hashable, Sendable {
    public enum Phase: Hashable, Sendable {
        case idle
        case syncing
        case failed(SyncFailure)
    }

    public var phase: Phase
    /// When the last sync finished without error; persisted across launches.
    public var lastSyncedAt: Date?

    public init(phase: Phase, lastSyncedAt: Date?) {
        self.phase = phase
        self.lastSyncedAt = lastSyncedAt
    }

    public static let initial = SyncStatus(phase: .idle, lastSyncedAt: nil)
}

/// Why the last sync stopped. A closed set, so the UI maps each case to copy (ERR-1).
public enum SyncFailure: Hashable, Sendable {
    /// No token is stored: show "Add your sync token".
    case notConfigured
    /// The server refused the token (401).
    case unauthorized
    /// Network error or 5xx: try again later; nothing was lost.
    case offline
    /// The server refused the request itself (a 4xx other than 401).
    case rejected(status: Int)
    /// The server answered with something that is not the contract.
    case invalidResponse
    /// The local database failed.
    case storage

    init(_ error: any Error) {
        switch error {
        case let transport as SyncTransportError: self.init(transport)
        default: self = .storage
        }
    }

    private init(_ error: SyncTransportError) {
        switch error {
        case .missingToken: self = .notConfigured
        case .unauthorized: self = .unauthorized
        case .retryable: self = .offline
        case .rejected(let status): self = .rejected(status: status)
        case .invalidResponse: self = .invalidResponse
        }
    }
}

extension SyncFailure {
    /// The `AppError` kind for this failure, for code that maps errors to copy in one place.
    public var errorKind: AppError.Kind {
        switch self {
        case .notConfigured, .unauthorized: .unauthorized
        case .offline: .offline
        case .rejected: .invalidInput
        case .invalidResponse: .decoding
        case .storage: .unknown
        }
    }
}
