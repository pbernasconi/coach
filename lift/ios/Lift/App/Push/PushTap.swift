import Foundation

/// A tapped notice's routing hints: the string keys the coach puts next to `aps` (lift/PUSH.md). Never its content.
nonisolated struct PushTap: Equatable, Sendable {
    let data: [String: String]

    init(data: [String: String]) {
        self.data = data
    }

    /// Drops `aps` and every key whose value is not a string.
    init(userInfo: [AnyHashable: Any]) {
        var data: [String: String] = [:]
        for (key, value) in userInfo {
            guard let key = key as? String, key != "aps", let value = value as? String else { continue }
            data[key] = value
        }
        self.init(data: data)
    }

    /// The `lift://` link the tap opens (`AppLink`).
    var link: URL? { data["link"].flatMap(URL.init(string:)) }

    /// The coach's id of the notice, for `POST /api/app/push/opened`; nil unless it is a UUID.
    var notificationID: String? {
        data["notificationId"].flatMap(UUID.init(uuidString:))?.uuidString.lowercased()
    }
}
