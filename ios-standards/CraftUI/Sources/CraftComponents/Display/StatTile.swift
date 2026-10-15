import CraftTokens
import Foundation
import SwiftUI

/// A change shown under a stat ("+5 lb"), toned and always with a glyph, so it never reads by colour alone.
public struct StatDelta {
    public let text: Text
    public let tone: Tone
    public let symbol: String

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
}

/// A compact card with a caption, a big value, an optional unit and an optional delta. Reads as one VoiceOver element.
///
///     StatTile(label: "Volume", value: "12.4k", unit: "lb", delta: StatDelta(verbatim: "+8%", tone: .success))
///     StatTile(label: "Sets", value: Double(done), unit: "/18")
public struct StatTile<Value: View>: View {
    private let label: Text
    private let value: Value
    private let unit: Text?
    private let delta: StatDelta?
    @Environment(\.craftTheme) private var theme

    private init(label: Text, content: Value, unit: Text?, delta: StatDelta?) {
        self.label = label
        self.value = content
        self.unit = unit
        self.delta = delta
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            label
                .font(theme.font(.caption).weight(.semibold))
                .textCase(.uppercase)
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
                    Image(systemName: delta.symbol).accessibilityHidden(true)
                }
                .font(theme.font(.caption).weight(.semibold))
                .foregroundStyle(theme.palette.status(delta.tone).ink)
            }
        }
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Space.md)
        .padding(.vertical, Space.rowVertical)
        .background(theme.palette.surface, in: RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

extension StatTile where Value == Text {
    /// A tile showing a ready-made value string (shown as is) under a localized label.
    public init(label: LocalizedStringKey, value: String, unit: LocalizedStringKey? = nil, delta: StatDelta? = nil) {
        self.init(label: Text(label), content: Text(verbatim: value), unit: unit.map { Text($0) }, delta: delta)
    }

    /// A tile whose label, value and unit are all shown as is (user-defined metrics).
    public init(verbatim label: String, value: String, unit: String? = nil, delta: StatDelta? = nil) {
        let unit = unit.map { Text(verbatim: $0) }
        self.init(label: Text(verbatim: label), content: Text(verbatim: value), unit: unit, delta: delta)
    }
}

extension StatTile {
    /// A tile whose number rolls to each new value (`AnimatedNumber`).
    public init<Format: FormatStyle>(
        label: LocalizedStringKey,
        value: Double,
        format: Format,
        unit: LocalizedStringKey? = nil,
        delta: StatDelta? = nil
    ) where Value == AnimatedNumber<Format>, Format.FormatInput == Double, Format.FormatOutput == String {
        let number = AnimatedNumber(value, format: format)
        self.init(label: Text(label), content: number, unit: unit.map { Text($0) }, delta: delta)
    }
}

extension StatTile where Value == AnimatedNumber<FloatingPointFormatStyle<Double>> {
    /// A tile whose number rolls to each new value, in the locale's default number format.
    public init(label: LocalizedStringKey, value: Double, unit: LocalizedStringKey? = nil, delta: StatDelta? = nil) {
        self.init(label: Text(label), content: AnimatedNumber(value), unit: unit.map { Text($0) }, delta: delta)
    }
}

private struct StatTilePreviews: View {
    @Environment(\.craftTheme) private var theme

    var body: some View {
        VStack(spacing: Space.sm) {
            HStack(spacing: Space.sm) {
                StatTile(label: "Sets", value: 16, unit: "/18")
                StatTile(label: "Volume", value: "12.4k", unit: "lb")
                StatTile(label: "Time", value: "52", unit: "min")
            }
            StatTile(
                label: "Est. 1RM",
                value: "245",
                unit: "lb",
                delta: StatDelta(verbatim: "+5 lb", tone: .success, symbol: "arrow.up")
            )
        }
        .padding()
        .background(theme.palette.canvas)
    }
}

#Preview("Stat tile") { StatTilePreviews() }
#Preview("Stat tile, dark") { StatTilePreviews().preferredColorScheme(.dark) }
#Preview("Stat tile, AX3") { StatTilePreviews().dynamicTypeSize(.accessibility3) }
