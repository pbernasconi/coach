import Foundation

/// One block of a `DayTimeline`: a time range ("09:00"–"10:15") and what fills it.
nonisolated public struct DayTimelineBlock: Identifiable, Equatable, Sendable {
    /// What fills the block. Each kind has its own bar and its own words, so it never reads by colour alone.
    public enum Kind: String, Equatable, Sendable, CaseIterable {
        /// Taken by something else (a meeting, travel).
        case busy
        /// Open time.
        case free
        /// The thing the reader cares about here (the planned item).
        case highlight
    }

    public let id: String
    public let start: String
    public let end: String
    public let kind: Kind
    public let title: String?

    public init(id: String, start: String, end: String, kind: Kind, title: String? = nil) {
        self.id = id
        self.start = start
        self.end = end
        self.kind = kind
        self.title = title
    }
}

/// The maths of a day timeline: clock times as minutes, a block's length as words, and the blocks in time order.
nonisolated enum DayTimelineMath {
    /// Minutes after midnight of "HH:mm", or nil when it is not a clock time.
    static func minutes(_ clock: String) -> Int? {
        let parts = clock.split(separator: ":")
        guard parts.count == 2, let hours = Int(parts[0]), let minutes = Int(parts[1]),
            (0...24).contains(hours), (0..<60).contains(minutes)
        else { return nil }
        return hours * 60 + minutes
    }

    /// "45 min", "2 h", "4 h 30"; nil when either end is not a clock time or the block has no length.
    static func lengthText(start: String, end: String) -> String? {
        guard let from = minutes(start), let to = minutes(end), to > from else { return nil }
        let length = to - from
        if length < 60 { return "\(length) min" }
        let rest = length % 60
        return rest == 0 ? "\(length / 60) h" : "\(length / 60) h \(rest < 10 ? "0" : "")\(rest)"
    }

    /// The blocks by start time; a block whose start is not a clock time goes last.
    static func ordered(_ blocks: [DayTimelineBlock]) -> [DayTimelineBlock] {
        blocks.enumerated().sorted { lhs, rhs in
            let left = minutes(lhs.element.start) ?? Int.max
            let right = minutes(rhs.element.start) ?? Int.max
            return left == right ? lhs.offset < rhs.offset : left < right
        }.map(\.element)
    }
}
