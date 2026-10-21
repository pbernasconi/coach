import Foundation
import KoboTokens
import SwiftUI

/// A change shown under a stat ("+5 km"), toned and with a glyph, so it never reads by colour alone. The glyph is an
/// SF Symbol, or the text's own arrow ("▼ 7%", `textOnly`).
public struct StatDelta {
    public let text: Text
    public let tone: Tone
    /// `nil` when the text carries its own arrow.
    public let symbol: String?

    /// A delta with localized text ("on track", "+\(change)%").
    ///
    /// - Parameter symbol: an SF Symbol ("arrow.up.right"); the tone's glyph when `nil`.
    public init(_ text: LocalizedStringKey, tone: Tone, symbol: String? = nil) {
        self.text = Text(text)
        self.tone = tone
        self.symbol = symbol ?? tone.feedbackSymbol
    }

    /// A delta whose text is shown as is (a formatted number).
    public init(verbatim text: String, tone: Tone, symbol: String? = nil) {
        self.text = Text(verbatim: text)
        self.tone = tone
        self.symbol = symbol ?? tone.feedbackSymbol
    }

    private init(text: Text, tone: Tone) {
        self.text = text
        self.tone = tone
        self.symbol = nil
    }

    /// A delta whose text already carries its arrow ("▼ 7%", "▲ 3 km"): coloured by `tone`, with no icon, so a fall
    /// does not read as an error. VoiceOver reads the arrow as a word ("down 7%").
    public static func textOnly(verbatim text: String, tone: Tone) -> StatDelta {
        StatDelta(text: Text(verbatim: text).accessibilityLabel(Text(verbatim: DeltaSpeech.spoken(text))), tone: tone)
    }
}

/// A compact card with a caption, a big value, an optional unit, an optional delta and an optional footer (a
/// `Sparkline`). Reads as one VoiceOver element.
///
///     StatTile(label: "Steps", value: "12.4k", unit: "today", delta: StatDelta(verbatim: "+8%", tone: .success))
///     StatTile(label: "Tasks", value: Double(done), unit: "/18")
///     StatTile(label: "Distance", value: "42.1", unit: "km") {
///         Sparkline(values: weekly, accessibilityLabel: "Distance trend")
///     }
public struct StatTile<Value: View, Footer: View>: View {
    private let label: Text
    private let value: Value
    private let unit: Text?
    private let delta: StatDelta?
    private let footer: Footer
    @Environment(\.koboTheme) private var theme
    @Environment(\.statTileFillsHeight) private var fillsHeight

    private init(label: Text, content: Value, unit: Text?, delta: StatDelta?, footer: Footer) {
        self.label = label
        self.value = content
        self.unit = unit
        self.delta = delta
        self.footer = footer
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            label
                .font(theme.font(.caption).weight(.semibold))
                .foregroundStyle(theme.palette.textSecondary)
            HStack(alignment: .firstTextBaseline, spacing: Space.xxs) {
                value
                    .font(theme.font(.title2))
                    .monospacedDigit()
                    .foregroundStyle(theme.palette.textPrimary)
                if let unit {
                    unit
                        .font(theme.font(.subheadline).weight(.semibold))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            if let delta {
                Label {
                    delta.text
                } icon: {
                    if let symbol = delta.symbol { Image(systemName: symbol).accessibilityHidden(true) }
                }
                .font(theme.font(.caption).weight(.semibold))
                .foregroundStyle(theme.palette.status(delta.tone).ink)
            }
            footer
        }
        .fixedSize(horizontal: false, vertical: true)
        // In a `.statTileRow()`, fills the row's height, top-aligned, so tiles in a row are as tall as the tallest.
        .frame(maxWidth: .infinity, maxHeight: fillsHeight ? .infinity : nil, alignment: .topLeading)
        .padding(.horizontal, Space.md)
        .padding(.vertical, Space.rowVertical)
        .background(theme.palette.surface, in: RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

extension StatTile where Value == Text, Footer == EmptyView {
    /// A tile showing a ready-made value string (shown as is) under a localized label.
    public init(label: LocalizedStringKey, value: String, unit: LocalizedStringKey? = nil, delta: StatDelta? = nil) {
        self.init(label: label, value: value, unit: unit, delta: delta) { EmptyView() }
    }

    /// A tile whose label, value and unit are all shown as is (user-defined metrics).
    public init(verbatim label: String, value: String, unit: String? = nil, delta: StatDelta? = nil) {
        self.init(verbatim: label, value: value, unit: unit, delta: delta) { EmptyView() }
    }
}

extension StatTile where Value == Text {
    /// A tile with a footer under its value, such as a `Sparkline` of the recent trend.
    public init(
        label: LocalizedStringKey,
        value: String,
        unit: LocalizedStringKey? = nil,
        delta: StatDelta? = nil,
        @ViewBuilder footer: () -> Footer
    ) {
        let unit = unit.map { Text($0) }
        self.init(label: Text(label), content: Text(verbatim: value), unit: unit, delta: delta, footer: footer())
    }

    /// A tile with a footer whose label, value and unit are all shown as is.
    public init(
        verbatim label: String,
        value: String,
        unit: String? = nil,
        delta: StatDelta? = nil,
        @ViewBuilder footer: () -> Footer
    ) {
        let unit = unit.map { Text(verbatim: $0) }
        let value = Text(verbatim: value)
        self.init(label: Text(verbatim: label), content: value, unit: unit, delta: delta, footer: footer())
    }
}

extension StatTile where Footer == EmptyView {
    /// A tile whose number rolls to each new value (`AnimatedNumber`).
    public init<Format: FormatStyle>(
        label: LocalizedStringKey,
        value: Double,
        format: Format,
        unit: LocalizedStringKey? = nil,
        delta: StatDelta? = nil
    ) where Value == AnimatedNumber<Format>, Format.FormatInput == Double, Format.FormatOutput == String {
        let number = AnimatedNumber(value, format: format)
        self.init(label: Text(label), content: number, unit: unit.map { Text($0) }, delta: delta, footer: EmptyView())
    }
}

extension StatTile where Value == AnimatedNumber<FloatingPointFormatStyle<Double>>, Footer == EmptyView {
    /// A tile whose number rolls to each new value, in the locale's default number format.
    public init(label: LocalizedStringKey, value: Double, unit: LocalizedStringKey? = nil, delta: StatDelta? = nil) {
        let unit = unit.map { Text($0) }
        self.init(label: Text(label), content: AnimatedNumber(value), unit: unit, delta: delta, footer: EmptyView())
    }
}

extension EnvironmentValues {
    @Entry var statTileFillsHeight = false
}

extension View {
    /// Makes the `StatTile`s inside take the full height they are offered, so tiles in one `Grid` row are equally tall.
    /// Off by default: a lone tile in a sheet or a stack keeps its own height.
    ///
    ///     Grid { GridRow { StatTile(…); StatTile(…) } }.statTileRow()
    public func statTileRow() -> some View {
        environment(\.statTileFillsHeight, true)
    }
}

private struct StatTilePreviews: View {
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(spacing: Space.sm) {
            HStack(spacing: Space.sm) {
                StatTile(label: "Tasks", value: 16, unit: "/18")
                StatTile(label: "Steps", value: "12.4k", unit: "today")
                StatTile(label: "Time", value: "52", unit: "min")
            }
            StatTile(
                label: "Longest walk",
                value: "24.5",
                unit: "km",
                delta: StatDelta(verbatim: "+5 km", tone: .success, symbol: "arrow.up")
            )
        }
        .padding()
        .background(theme.palette.canvas)
    }
}

#if DEBUG
    #Preview("Stat tile") { StatTilePreviews() }
    #Preview("Stat tile, dark") { StatTilePreviews().preferredColorScheme(.dark) }
    #Preview("Stat tile, AX3") { StatTilePreviews().dynamicTypeSize(.accessibility3) }
#endif
