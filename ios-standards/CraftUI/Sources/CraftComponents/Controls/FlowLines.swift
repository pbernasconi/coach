import Foundation

/// The pure line-breaking maths of `FlowLayout`, tested apart from SwiftUI.
nonisolated enum FlowLines {
    /// The subview indexes of each line. Items keep their order; an item wider than the line sits alone.
    static func lines(widths: [CGFloat], maxWidth: CGFloat, spacing: CGFloat) -> [[Int]] {
        var lines: [[Int]] = []
        var current: [Int] = []
        var used: CGFloat = 0
        for (index, width) in widths.enumerated() {
            let needed = current.isEmpty ? width : used + spacing + width
            if !current.isEmpty, needed > maxWidth {
                lines.append(current)
                current = [index]
                used = width
            } else {
                current.append(index)
                used = needed
            }
        }
        if !current.isEmpty { lines.append(current) }
        return lines
    }

    /// The width of one line: its items plus the gaps between them.
    static func width(of line: [Int], widths: [CGFloat], spacing: CGFloat) -> CGFloat {
        line.map { widths[$0] }.reduce(0, +) + spacing * CGFloat(max(line.count - 1, 0))
    }
}
