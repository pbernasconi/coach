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

    /// The first line of a session's note for a list row, cut at `limit` characters; nil when there is no note.
    static func notePreview(_ note: String?, limit: Int = 80) -> String? {
        let line = note?.split(whereSeparator: \.isNewline)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .first { !$0.isEmpty }
        guard let line else { return nil }
        return line.count > limit ? line.prefix(limit - 1).trimmingCharacters(in: .whitespaces) + "…" : line
    }
}
