import Foundation

/// One part of a `ProfileStrip`: how long it lasts (its width), how high it starts and ends (equal for a flat block, a
/// slope otherwise) and a level 0...4 for its colour, calm to hot.
nonisolated public struct ProfileSegment: Identifiable, Hashable, Sendable {
    public let id: Int
    public let width: Double
    public let start: Double
    public let end: Double
    public let level: Int

    public init(id: Int, width: Double, start: Double, end: Double? = nil, level: Int) {
        self.id = id
        self.width = width
        self.start = start
        self.end = end ?? start
        self.level = level
    }
}

/// A segment placed in a unit box: x from 0 to 1 left to right, heights from 0 to 1 bottom to top.
nonisolated struct ProfileShape: Equatable, Sendable {
    let x0: Double
    let x1: Double
    let top0: Double
    let top1: Double
    let level: Int
}

/// Pure maths for `ProfileStrip`: segments end to end across the width, heights against the tallest one (or `floor`,
/// whichever is higher, so a calm profile does not fill the strip).
nonisolated enum ProfileMath {
    static func shapes(_ segments: [ProfileSegment], floor: Double = 1.25) -> [ProfileShape] {
        let clean = segments.filter { $0.width.isFinite && $0.width > 0 && $0.start.isFinite && $0.end.isFinite }
        let total = clean.reduce(0) { $0 + $1.width }
        guard total > 0 else { return [] }
        let top = max(floor, clean.map { max($0.start, $0.end) }.max() ?? 0)
        var x = 0.0
        return clean.map { segment in
            let x0 = x
            x += segment.width / total
            return ProfileShape(
                x0: x0,
                x1: x,
                top0: min(max(segment.start / top, 0), 1),
                top1: min(max(segment.end / top, 0), 1),
                level: min(max(segment.level, 0), 4)
            )
        }
    }
}
