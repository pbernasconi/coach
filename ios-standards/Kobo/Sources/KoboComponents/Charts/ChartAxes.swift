import Charts
import Foundation
import KoboTokens
import SwiftUI

/// The axes every Kobo chart shares: hairline grid in the separator colour, labels in the theme's caption font (so they
/// grow with Dynamic Type), fewer x labels at accessibility sizes, and values on the trailing edge.
struct ChartAxes<X: KoboChartX>: ViewModifier {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    /// The x values to label; the chart chooses when empty.
    let xTicks: [X]
    let xText: (X) -> String
    let yText: (Double) -> String
    let showsXLabels: Bool

    func body(content: Content) -> some View {
        content
            .chartXAxis { xAxis }
            .chartYAxis { yAxis }
    }

    private var xCount: Int { dynamicTypeSize.isAccessibilitySize ? 2 : 4 }

    @AxisContentBuilder private var xAxis: some AxisContent {
        if !xTicks.isEmpty {
            AxisMarks(values: ChartMath.thinned(xTicks, to: dynamicTypeSize.isAccessibilitySize ? 3 : 6)) { value in
                xMark(value)
            }
        } else {
            AxisMarks(values: .automatic(desiredCount: xCount)) { value in xMark(value) }
        }
    }

    @AxisMarkBuilder private func xMark(_ value: AxisValue) -> some AxisMark {
        AxisGridLine().foregroundStyle(theme.palette.separator)
        AxisValueLabel {
            if showsXLabels, let x = value.as(X.self) {
                Text(verbatim: xText(x))
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textSecondary)
            }
        }
    }

    @AxisContentBuilder private var yAxis: some AxisContent {
        AxisMarks(position: .trailing, values: .automatic(desiredCount: 3)) { value in
            AxisGridLine().foregroundStyle(theme.palette.separator)
            AxisValueLabel {
                if let y = value.as(Double.self) {
                    Text(verbatim: yText(y))
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
        }
    }
}

extension View {
    /// Kobo's shared chart axes (see `ChartAxes`).
    func chartAxes<X: KoboChartX>(
        xTicks: [X] = [],
        xText: @escaping (X) -> String,
        yText: @escaping (Double) -> String,
        showsXLabels: Bool = true
    ) -> some View {
        modifier(ChartAxes(xTicks: xTicks, xText: xText, yText: yText, showsXLabels: showsXLabels))
    }
}
