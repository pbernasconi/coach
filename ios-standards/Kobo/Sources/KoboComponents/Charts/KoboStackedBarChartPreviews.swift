import Foundation
import KoboTokens
import SwiftUI

#if DEBUG
    private struct KoboStackedBarChartPreview: View {
        @Environment(\.koboTheme) private var theme
        private let start = Date(timeIntervalSinceReferenceDate: 780_000_000)
        private let categories = [
            BarCategory(id: "walk", name: "Walk"),
            BarCategory(id: "ride", name: "Ride"),
            BarCategory(id: "swim", name: "Swim"),
        ]

        var body: some View {
            ScrollView {
                VStack(alignment: .leading, spacing: Space.section) {
                    KoboStackedBarChart(
                        groups: weeks,
                        categories: categories,
                        reference: ChartReference(y: 6.1, label: "Avg 6.1 h"),
                        markLabel: "Long outing",
                        xText: ChartFormat.date,
                        yText: { "\(Int($0)) h" },
                        accessibilityLabel: "Hours per week"
                    )
                    VariableWidthBarChart(
                        bars: splits,
                        yDirection: .down,
                        xText: { "\(Int($0)) km" },
                        yText: { String(format: "%d:%02d", Int($0), Int(($0 - Double(Int($0))) * 60)) },
                        accessibilityLabel: "Minutes per km"
                    )
                }
                .padding()
            }
            .background(theme.palette.canvas)
        }

        private var weeks: [BarGroup<Date>] {
            (0..<10).map { week in
                let x = Double(week)
                return BarGroup(
                    x: start.addingTimeInterval(x * 7 * 86_400),
                    values: ["walk": 2 + sin(x) * 1.2, "ride": 3 + cos(x / 2) * 1.5, "swim": week % 3 == 0 ? 1 : 0],
                    isPartial: week == 9,
                    isMarked: week % 4 == 1
                )
            }
        }

        private var splits: [WidthBar] {
            [1.0, 1, 1, 1, 0.4, 1, 1, 0.25].enumerated().map { index, width in
                let value = 5.2 - sin(Double(index)) * 0.5 - (width < 1 ? 0.6 : 0)
                return WidthBar(id: "\(index)", width: width, value: value)
            }
        }
    }

    #Preview("Stacked bars") { KoboStackedBarChartPreview() }
    #Preview("Stacked bars, dark") { KoboStackedBarChartPreview().preferredColorScheme(.dark) }
    #Preview("Stacked bars, AX3") { KoboStackedBarChartPreview().dynamicTypeSize(.accessibility3) }
#endif
