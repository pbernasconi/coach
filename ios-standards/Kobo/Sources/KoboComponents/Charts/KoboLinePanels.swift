import Charts
import Foundation
import KoboTokens
import SwiftUI

/// One panel of a `KoboLinePanels` stack: a title, its lines and how its y axis reads.
public struct LinePanel<X: KoboChartX>: Identifiable {
    public let id: String
    public let title: String
    public let series: [ChartSeries<X>]
    public let bands: [ChartBand]
    public let yDirection: ChartYDirection
    public let yText: (Double) -> String

    /// - Parameters:
    ///   - title: shown as is above the panel, and read by VoiceOver.
    ///   - yText: text for this panel's values (each panel has its own unit).
    public init(
        id: String,
        title: String,
        series: [ChartSeries<X>],
        bands: [ChartBand] = [],
        yDirection: ChartYDirection = .up,
        yText: @escaping (Double) -> String = ChartFormat.number
    ) {
        self.id = id
        self.title = title
        self.series = series
        self.bands = bands
        self.yDirection = yDirection
        self.yText = yText
    }
}

/// Small multiples: compact line charts stacked on one shared x range, so a touch on any panel shows the same moment
/// in all of them (speed, height, rate…). Only the bottom panel labels x. Each panel is its own VoiceOver element.
///
///     KoboLinePanels(
///         panels: [
///             LinePanel(id: "speed", title: "Speed", series: [speed], yText: { "\(Int($0)) km/h" }),
///             LinePanel(id: "height", title: "Height", series: [height], yText: { "\(Int($0)) m" }),
///         ],
///         xText: { "\(Int($0)) km" }
///     )
public struct KoboLinePanels<X: KoboChartX>: View {
    @Environment(\.koboTheme) private var theme
    @State private var ownSelection: X?
    private let panels: [LinePanel<X>]
    private let externalSelection: Binding<X?>?
    private let xText: (X) -> String

    /// - Parameter selection: the touched x, shared by every panel; the stack keeps its own when `nil`.
    public init(panels: [LinePanel<X>], selection: Binding<X?>? = nil, xText: @escaping (X) -> String) {
        self.panels = panels
        self.externalSelection = selection
        self.xText = xText
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            ForEach(Array(panels.enumerated()), id: \.element.id) { index, panel in
                VStack(alignment: .leading, spacing: Space.xxs) {
                    Text(verbatim: panel.title)
                        .font(theme.font(.caption).weight(.semibold))
                        .foregroundStyle(theme.palette.textSecondary)
                        .accessibilityHidden(true)
                    KoboLineChart(
                        series: panel.series,
                        bands: panel.bands,
                        yDirection: panel.yDirection,
                        height: .compact,
                        selection: selection,
                        xText: xText,
                        yText: panel.yText,
                        verbatimAccessibilityLabel: panel.title
                    )
                    .panel(xDomain: sharedDomain, showsXLabels: index == panels.count - 1)
                }
            }
        }
    }

    private var selection: Binding<X?> { externalSelection ?? $ownSelection }

    /// The x range across every panel, so the panels line up.
    private var sharedDomain: ClosedRange<X>? {
        let xs = panels.flatMap { $0.series.flatMap { $0.points.map(\.x) } }
        guard let low = xs.min(), let high = xs.max() else { return nil }
        return low...high
    }
}
