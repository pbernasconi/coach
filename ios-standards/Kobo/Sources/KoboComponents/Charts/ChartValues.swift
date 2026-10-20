import Charts
import Foundation
import KoboTokens
import SwiftUI

/// A value a Kobo chart can place along its x axis: a `Date`, a `Double` or an `Int`. `chartPosition` puts it on a
/// number line, so the chart can find the point nearest a touch.
public protocol KoboChartX: Plottable, Comparable, Hashable, Sendable {
    /// The value as a number, increasing with the value.
    var chartPosition: Double { get }
}

extension Date: KoboChartX {
    public var chartPosition: Double { timeIntervalSinceReferenceDate }
}

extension Double: KoboChartX {
    public var chartPosition: Double { self }
}

extension Int: KoboChartX {
    public var chartPosition: Double { Double(self) }
}

/// One point of a line: an x value and a y value.
public struct ChartPoint<X: KoboChartX>: Hashable, Sendable {
    public let x: X
    public let y: Double

    public init(x: X, y: Double) {
        self.x = x
        self.y = y
    }
}

/// A horizontal shaded band behind a chart (a target zone, a "fresh" or "tired" range), with a label and a tone.
/// The label is shown on the band, so the zone never reads by colour alone.
public struct ChartBand: Hashable, Sendable {
    public let range: ClosedRange<Double>
    public let label: String
    public let tone: Tone

    /// - Parameter label: shown as is at the band's leading edge; may be empty.
    public init(_ range: ClosedRange<Double>, label: String, tone: Tone) {
        self.range = range
        self.label = label
        self.tone = tone
    }
}

/// A dashed horizontal line at a reference value (a goal, a threshold), labelled at its trailing end.
public struct ChartReference: Hashable, Sendable {
    public let y: Double
    public let label: String

    /// - Parameter label: shown as is; may be empty.
    public init(y: Double, label: String) {
        self.y = y
        self.label = label
    }
}

/// An event on a chart's x axis: a vertical rule ("Today") or, with a `y`, a dot on the plot, labelled above.
public struct ChartMarker<X: KoboChartX>: Hashable, Sendable {
    public let x: X
    public let y: Double?
    public let label: String
    public let tone: Tone

    /// - Parameters:
    ///   - y: a dot at this value; a full-height rule when `nil`.
    ///   - label: shown as is above the marker.
    public init(x: X, y: Double? = nil, label: String, tone: Tone = .neutral) {
        self.x = x
        self.y = y
        self.label = label
        self.tone = tone
    }
}

/// How tall a chart's plot is at the default text size. It grows with Dynamic Type.
public enum ChartHeight: Sendable {
    /// A small multiple in a stack of panels (96 pt).
    case compact
    /// A chart on its own (180 pt).
    case regular
    /// A chart that leads a screen (240 pt).
    case tall

    var points: CGFloat {
        switch self {
        case .compact: 96
        case .regular: 180
        case .tall: 240
        }
    }
}

extension Palette {
    /// The colour for the `index`th data series: accent, info, success, warning, danger, then around again. Every role
    /// already resolves for light, dark and increased contrast. Pair colours with labels; never rely on them alone.
    public func chartColor(_ index: Int) -> Color {
        let colors = [accent, info.ink, success.ink, warning.ink, danger.ink, neutral.ink]
        return colors[((index % colors.count) + colors.count) % colors.count]
    }
}
