import Foundation
import KoboTokens
import SwiftUI

/// A horizontal bar from zero to a value over a quiet track, with a target band shaded behind it (edges marked over the
/// bar, so it shows where the bar crosses them) and an optional tick (a 4-week average), all on one scale 0…`scaleMax`.
/// Without an accessibility label it is decorative: the row around it reads the number. With one, VoiceOver reads the
/// value and where it sits ("12, within the target").
///
///     BandBar(value: 12, scaleMax: 25, band: 10...20, tick: 9)
///     BandBar(value: 4, scaleMax: 10, band: 5...8, valueText: "4 h", accessibilityLabel: "Reading")
public struct BandBar: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var height = Space.sm
    private let value: Double
    private let scaleMax: Double
    private let band: ClosedRange<Double>?
    private let tick: Double?
    private let tone: Tone
    private let valueText: String?
    private var label: Text?

    /// - Parameters:
    ///   - scaleMax: the value at the trailing edge; larger values are clamped.
    ///   - band: the target range, shaded.
    ///   - tick: a marker at a second value, such as an average.
    ///   - tone: the bar's colour; the accent by default.
    ///   - valueText: what VoiceOver reads for the value; the number when `nil`.
    ///   - accessibilityLabel: what the bar measures; decorative when `nil`.
    public init(
        value: Double,
        scaleMax: Double,
        band: ClosedRange<Double>? = nil,
        tick: Double? = nil,
        tone: Tone = .accent,
        valueText: String? = nil,
        accessibilityLabel: LocalizedStringKey? = nil
    ) {
        self.value = value
        self.scaleMax = scaleMax
        self.band = band
        self.tick = tick
        self.tone = tone
        self.valueText = valueText
        self.label = accessibilityLabel.map { Text($0) }
    }

    /// A bar whose accessibility label is shown as is (it names user data).
    public init(
        value: Double,
        scaleMax: Double,
        band: ClosedRange<Double>? = nil,
        tick: Double? = nil,
        tone: Tone = .accent,
        valueText: String? = nil,
        verbatimAccessibilityLabel: String
    ) {
        self.init(value: value, scaleMax: scaleMax, band: band, tick: tick, tone: tone, valueText: valueText)
        self.label = Text(verbatim: verbatimAccessibilityLabel)
    }

    public var body: some View {
        SpanLayout {
            Capsule()
                .fill(theme.palette.surfaceSunken)
                .span(0...1)
            if let band {
                Rectangle()
                    .fill(bandFill)
                    .span(fraction(band.lowerBound)...fraction(band.upperBound))
            }
            Capsule()
                .fill(barFill)
                .opacity(value > 0 ? 1 : 0)
                .span(0...fraction(value))
            if let band {
                edge.span(fraction(band.lowerBound)...fraction(band.lowerBound))
                edge.span(fraction(band.upperBound)...fraction(band.upperBound))
            }
            if let tick {
                Capsule()
                    .fill(theme.palette.textPrimary)
                    .frame(width: Space.xxs)
                    .offset(x: -Space.xxs / 2)
                    .span(fraction(tick)...fraction(tick))
            }
        }
        .frame(height: height)
        .koboAnimation(.state, value: value)
        .accessibilityElement(children: .ignore)
        .modifier(BandBarAccessibility(label: label, value: spokenValue))
    }

    private var barFill: Color { tone == .accent ? theme.palette.accent : theme.palette.status(tone).ink }
    private var bandFill: Color { theme.palette.status(tone).soft }

    /// A band edge: a thin rule drawn over the bar.
    private var edge: some View {
        Rectangle()
            .fill(theme.palette.status(tone).ink)
            .frame(width: Size.hairline * 2)
            .offset(x: -Size.hairline)
    }

    private var spokenValue: String {
        let number = valueText ?? ChartFormat.number(value)
        guard band != nil else { return number }
        let position =
            switch BandPosition(value, band: band) {
            case .below: String(localized: "below the target", bundle: .module)
            case .within: String(localized: "within the target", bundle: .module)
            case .above: String(localized: "above the target", bundle: .module)
            }
        return "\(number), \(position)"
    }

    private func fraction(_ value: Double) -> Double { ChartMath.fraction(value, of: scaleMax) }
}

/// Reads the bar when it has a label; hides it when the row around it speaks for it.
private struct BandBarAccessibility: ViewModifier {
    let label: Text?
    let value: String

    func body(content: Content) -> some View {
        if let label {
            content.accessibilityLabel(label).accessibilityValue(Text(verbatim: value))
        } else {
            content.accessibilityHidden(true)
        }
    }
}

private struct BandBarPreview: View {
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            BandBar(value: 12, scaleMax: 25, band: 10...20, tick: 9, accessibilityLabel: "Reading")
            BandBar(value: 4, scaleMax: 25, band: 10...20, tick: 8)
            BandBar(value: 23, scaleMax: 25, band: 10...20, tone: .warning)
            BandBar(value: 0.6, scaleMax: 1, tone: .success)
        }
        .padding()
        .background(theme.palette.canvas)
    }
}

#if DEBUG
    #Preview("Band bar") { BandBarPreview() }
    #Preview("Band bar, dark") { BandBarPreview().preferredColorScheme(.dark) }
    #Preview("Band bar, AX3") { BandBarPreview().dynamicTypeSize(.accessibility3) }
#endif
