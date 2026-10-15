/// Where a set stands. Saving weight or reps never changes it; only logging, skipping or unlogging does.
public enum SetStatus: String, Codable, Hashable, Sendable, CaseIterable {
    case planned
    case done
    case skipped
}
