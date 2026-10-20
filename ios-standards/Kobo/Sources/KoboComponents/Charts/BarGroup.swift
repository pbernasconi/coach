import Foundation
import SwiftUI

/// A category of a `KoboStackedBarChart` (one colour in every bar), named in the legend and the callout.
public struct BarCategory: Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let color: Color?

    /// - Parameters:
    ///   - name: shown as is in the legend and the callout.
    ///   - color: the segment colour; the theme's `chartColor` for the category's position when `nil`.
    public init(id: String, name: String, color: Color? = nil) {
        self.id = id
        self.name = name
        self.color = color
    }
}

/// One bar of a `KoboStackedBarChart`: its x, each category's value, and two flags. A partial bar (the current week,
/// still filling) is drawn faded; a marked bar gets a dot under it (explained by the chart's `markLabel`).
public struct BarGroup<X: KoboChartX>: Identifiable, Hashable, Sendable {
    public let x: X
    public let values: [String: Double]
    public let isPartial: Bool
    public let isMarked: Bool

    public var id: X { x }

    /// - Parameter values: category id to value; missing categories count as zero.
    public init(x: X, values: [String: Double], isPartial: Bool = false, isMarked: Bool = false) {
        self.x = x
        self.values = values
        self.isPartial = isPartial
        self.isMarked = isMarked
    }

    /// The bar's height: every finite, positive value added up.
    var total: Double {
        values.values.filter { $0.isFinite && $0 > 0 }.reduce(0, +)
    }

    /// Each category's segment from the bottom up, in the order of `categories`.
    func segments(_ categories: [BarCategory]) -> [(category: Int, span: Range<Double>)] {
        let spans = ChartMath.spans(widths: categories.map { values[$0.id] ?? 0 })
        return spans.enumerated().compactMap { index, span in span.isEmpty ? nil : (index, span) }
    }
}
