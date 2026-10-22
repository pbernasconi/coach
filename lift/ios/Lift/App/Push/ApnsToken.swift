import Foundation

/// The APNs device token as `POST /api/app/push/devices` takes it: lower-case hex, two digits per byte.
nonisolated enum ApnsToken {
    static func hex(_ deviceToken: Data) -> String {
        deviceToken.map { String(format: "%02x", $0) }.joined()
    }
}
