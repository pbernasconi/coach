import Foundation

/// The title of a `HeaderProfileButton`. Pure, so tests check it without rendering.
nonisolated enum HeaderProfileTitle {
    /// The name as given, trimmed; `nil` when it is missing or blank, so the capsule says "Profile".
    static func title(name: String?) -> String? {
        guard let trimmed = name?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else { return nil }
        return trimmed
    }
}
