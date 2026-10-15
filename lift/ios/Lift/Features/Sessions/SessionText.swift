import Foundation

/// Plain labels for session counts, shared by the Week and History lists.
nonisolated enum SessionText {
    /// "1 exercise", "5 exercises".
    static func exercises(_ count: Int) -> String {
        count == 1 ? String(localized: "1 exercise") : String(localized: "\(count) exercises")
    }

    /// "12/15 sets".
    static func sets(logged: Int, total: Int) -> String {
        String(localized: "\(logged)/\(total) sets")
    }
}
