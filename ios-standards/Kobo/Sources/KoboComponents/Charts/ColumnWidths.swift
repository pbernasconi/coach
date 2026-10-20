import Foundation
import SwiftUI

/// The widest cell seen in each column, so rows built as separate stacks (each its own button or VoiceOver element)
/// still line up like a table. Cells report their natural width; the container keeps the largest per column and hands
/// it back. Widths follow Dynamic Type because they are measured, never fixed.
nonisolated struct ColumnWidthKey: PreferenceKey {
    static let defaultValue: [Int: CGFloat] = [:]

    static func reduce(value: inout [Int: CGFloat], nextValue: () -> [Int: CGFloat]) {
        value.merge(nextValue()) { max($0, $1) }
    }
}

extension View {
    /// Measures this cell as part of column `index` and gives it the column's width (`nil` until measured).
    func tableColumn(_ index: Int, width: CGFloat?, alignment: Alignment) -> some View {
        fixedSize()
            .background {
                GeometryReader { proxy in
                    Color.clear.preference(key: ColumnWidthKey.self, value: [index: proxy.size.width])
                }
            }
            .frame(width: width, alignment: alignment)
    }

    /// Collects the column widths its cells report into `widths`.
    func collectsColumnWidths(_ widths: Binding<[Int: CGFloat]>) -> some View {
        onPreferenceChange(ColumnWidthKey.self) { value in
            widths.wrappedValue = value
        }
    }
}

/// Places each subview across the full height at its `span`, a fraction of the width (0 is the leading edge, 1 the
/// trailing one). Takes whatever width it is offered.
struct SpanLayout: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews _: Subviews, cache _: inout ()) -> CGSize {
        proposal.replacingUnspecifiedDimensions()
    }

    func placeSubviews(in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        for subview in subviews {
            let span = subview[SpanKey.self]
            let width = bounds.width * (span.upperBound - span.lowerBound)
            subview.place(
                at: CGPoint(x: bounds.minX + bounds.width * span.lowerBound, y: bounds.minY),
                anchor: .topLeading,
                proposal: ProposedViewSize(width: width, height: bounds.height)
            )
        }
    }
}

private nonisolated struct SpanKey: LayoutValueKey {
    static let defaultValue: ClosedRange<Double> = 0...1
}

extension View {
    /// The part of a `SpanLayout`'s width this view covers.
    func span(_ range: ClosedRange<Double>) -> some View {
        layoutValue(key: SpanKey.self, value: range)
    }
}
