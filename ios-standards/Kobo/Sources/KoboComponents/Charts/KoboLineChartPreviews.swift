import Foundation
import KoboTokens
import SwiftUI

#if DEBUG
    /// Made-up data for the chart previews: smooth waves, never real records.
    private enum LineSamples {
        static let start = Date(timeIntervalSinceReferenceDate: 780_000_000)
        static let day: TimeInterval = 86_400

        static func wave(days: Int, base: Double, swing: Double, offset: Double = 0) -> [ChartPoint<Date>] {
            (0..<days).map { index in
                let x = Double(index)
                let y = base + swing * sin(x / 9 + offset) + x * 0.15
                return ChartPoint(x: start.addingTimeInterval(x * day), y: y)
            }
        }

        static func stream(_ base: Double, _ swing: Double, _ speed: Double) -> [ChartPoint<Double>] {
            stride(from: 0.0, through: 12, by: 0.1).map { km in
                ChartPoint(x: km, y: base + swing * sin(km * speed) + swing * 0.3 * cos(km * 3.1))
            }
        }
    }

    private struct KoboLineChartPreview: View {
        @Environment(\.koboTheme) private var theme

        var body: some View {
            ScrollView {
                VStack(alignment: .leading, spacing: Space.section) {
                    trend
                    curve
                    KoboLinePanels(
                        panels: [
                            LinePanel(id: "speed", title: "Speed", series: [speedSeries], yText: { "\(Int($0)) km/h" }),
                            LinePanel(id: "height", title: "Height", series: [heightSeries], yText: { "\(Int($0)) m" }),
                        ],
                        xText: { "\(Int($0)) km" }
                    )
                    KoboLineChart(series: [ChartSeries<Date>](), xText: ChartFormat.date, accessibilityLabel: "Empty")
                }
                .padding()
            }
            .background(theme.palette.canvas)
        }

        private var trend: some View {
            let actual = LineSamples.wave(days: 70, base: 40, swing: 8)
            let plan = LineSamples.wave(days: 90, base: 41, swing: 6).suffix(21)
            return KoboLineChart(
                series: [
                    ChartSeries(id: "score", name: "Score", points: actual, fillsArea: true),
                    ChartSeries(id: "plan", name: "Plan", points: Array(plan), stroke: .dashed),
                ],
                bands: [ChartBand(30...45, label: "Steady", tone: .success)],
                references: [ChartReference(y: 55, label: "Goal 55")],
                markers: [ChartMarker(x: LineSamples.start.addingTimeInterval(69 * LineSamples.day), label: "Today")],
                height: .tall,
                xText: ChartFormat.date,
                accessibilityLabel: "Score, last 70 days"
            )
        }

        private var curve: some View {
            let seconds: [Double] = [5, 10, 30, 60, 120, 300, 600, 1_200, 1_800, 3_600]
            let best = seconds.map { ChartPoint(x: $0, y: 900 / pow($0, 0.28) + 120) }
            return KoboLineChart(
                series: [ChartSeries(id: "best", name: "Best", points: best, showsPoints: true)],
                references: [ChartReference(y: 240, label: "Threshold 240")],
                xText: { $0 < 60 ? "\(Int($0))s" : "\(Int($0 / 60))m" },
                accessibilityLabel: "Best output by duration"
            )
            .logarithmicX(ticks: [5, 30, 60, 300, 1_200, 3_600])
        }

        private var speedSeries: ChartSeries<Double> {
            ChartSeries(id: "speed", name: "Speed", points: LineSamples.stream(24, 4, 0.9))
        }

        private var heightSeries: ChartSeries<Double> {
            ChartSeries(id: "height", name: "Height", points: LineSamples.stream(320, 40, 0.4), fillsArea: true)
        }
    }

    #Preview("Line chart") { KoboLineChartPreview() }
    #Preview("Line chart, dark") { KoboLineChartPreview().preferredColorScheme(.dark) }
    #Preview("Line chart, AX3") { KoboLineChartPreview().dynamicTypeSize(.accessibility3) }
#endif
