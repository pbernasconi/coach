import Foundation

/// The coach web app's origin, read from the `LiftSyncBaseURL` Info.plist key, which the `LIFT_SYNC_BASE_URL` build
/// setting fills (empty by default, so sync stays off).
nonisolated enum SyncServer {
    static let infoKey = "LiftSyncBaseURL"

    /// An `https` URL with a host, or nil for anything else (missing, empty, unexpanded, or plain `http`).
    static func baseURL(from value: Any?) -> URL? {
        guard let text = value as? String else { return nil }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmed), url.scheme?.lowercased() == "https", let host = url.host(),
            !host.isEmpty
        else { return nil }
        return url
    }
}
