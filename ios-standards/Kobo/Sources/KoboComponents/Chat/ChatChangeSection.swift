import Foundation

/// One group of a `ChatChangeCard`, usually a day: a heading and the rows as they will be once the changes apply.
nonisolated public struct ChatChangeSection: Identifiable, Equatable, Sendable {
    public let id: String
    public let title: String
    public let rows: [ChatChangeRow]

    public init(id: String, title: String, rows: [ChatChangeRow]) {
        self.id = id
        self.title = title
        self.rows = rows
    }
}

/// One thing in a `ChatChangeCard` as it will be after Apply: an icon, a title, a caption and one short tag that says
/// what happens to it ("From Sat", "New", "Skipped"). The tag's words carry the meaning; its tone only tints it.
nonisolated public struct ChatChangeRow: Identifiable, Equatable, Sendable {
    /// How the tag is tinted: moved or edited, new, or taken out.
    public enum Tone: String, Equatable, Sendable, CaseIterable {
        case changed
        case added
        case removed
    }

    public let id: String
    public let title: String
    public let caption: String?
    public let tag: String
    public let tone: Tone
    /// An SF Symbol for what the row is (a sport, a meeting); nil draws no icon tile.
    public let systemImage: String?

    public init(id: String, title: String, caption: String? = nil, tag: String, tone: Tone, systemImage: String? = nil)
    {
        self.id = id
        self.title = title
        self.caption = caption
        self.tag = tag
        self.tone = tone
        self.systemImage = systemImage
    }

    /// The words VoiceOver reads for the row: "Upper, 09:45 · 1 h, From Sat".
    public var spoken: String {
        [title, caption, tag].compactMap(\.self).filter { !$0.isEmpty }.joined(separator: ", ")
    }
}

/// Undo can put back only part of what Apply did (something changed since): the card asks first, with `message`
/// ("You moved Upper since…") and an "Undo `count`" button.
nonisolated public struct ChatUndoConfirm: Equatable, Sendable {
    public let message: String
    public let count: Int

    public init(message: String, count: Int) {
        self.message = message
        self.count = count
    }
}

extension Array where Element == ChatChangeSection {
    /// How many rows the sections hold: the "Apply 5 changes" count.
    nonisolated public var rowCount: Int { reduce(0) { $0 + $1.rows.count } }
}
