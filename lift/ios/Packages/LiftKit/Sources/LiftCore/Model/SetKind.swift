import Foundation

/// The role of a set. Warm-ups never count toward volume or progression.
public enum SetKind: String, Codable, Hashable, Sendable, CaseIterable {
    case warmUp
    case working
    case drop
    case failure
}
