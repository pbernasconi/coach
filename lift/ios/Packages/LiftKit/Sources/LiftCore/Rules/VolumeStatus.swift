import Foundation

/// Where a muscle's weekly hard sets sit against the target band.
public enum VolumeStatus: String, Codable, Hashable, Sendable {
    case below
    case inRange
    case above
}
