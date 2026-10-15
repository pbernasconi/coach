import CraftTokens
import Foundation
import SwiftUI

/// A change shown under a stat ("+5 lb"), toned and always with a glyph, so it never reads by colour alone.
public struct StatDelta {
    public let text: String
    public let tone: Tone
    public let symbol: String

    /// - Parameter symbol: an SF Symbol ("arrow.up.right"); the tone's glyph when `nil`.
    public init(_ text: String, tone: Tone, symbol: String? = nil) {
        self.text = text
        self.tone = tone
        self.symbol = symbol ?? tone.feedbackSymbol
    }
}

/// A compact card with a caption, a big value, an optional unit and an optional delta. Reads as one VoiceOver element.
///
///     StatTile(label: "Volume", value: "12.4k", unit: "lb", delta: StatDelta("+8%", tone: .success, symbol: "arrow.up"))
///     StatTile(label: "Sets", value: Double(done), unit: "/18")
public struct StatTile<Value: View>: View {
    private let label: String
    private let value: Value
    private let unit: String?
    private let delta: StatDelta?
    @Environment(\.craftTheme) private var theme

    private init(label: String, content: Value, unit: String?, delta: StatDelta?) {
        self.label = label
        self.value = content
        self.unit = unit
        self.delta = delta
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Text(label)
                .font(theme.font(.caption).weight(.semibold))
                .textCase(.uppercase)
                .foregroundStyle(theme.palette.textSecondary)
            HStack(alignment: .firstTextBaseline, spacing: Space.xxs) {
                value
                    .font(theme.font(.title2))
                    .monospacedDigit()
                    .foregroundStyle(theme.palette.textPrimary)
                if let unit {
                    Text(unit)
                        .font(theme.font(.subheadline).weight(.semibold))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            if let delta {
                Label {
                    Text(delta.text)
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
    /// A tile showing a ready-made value string.
    public init(label: String, value: String, unit: String? = nil, delta: StatDelta? = nil) {
        self.init(label: label, content: Text(value), unit: unit, delta: delta)
    }
}

extension StatTile {
    /// A tile whose number rolls to each new value (`AnimatedNumber`).
    public init<Format: FormatStyle>(
        label: String,
        value: Double,
        format: Format,
        unit: String? = nil,
        delta: StatDelta? = nil
    ) where Value == AnimatedNumber<Format>, Format.FormatInput == Double, Format.FormatOutput == String {
        self.init(label: label, content: AnimatedNumber(value, format: format), unit: unit, delta: delta)
    }
}

extension StatTile where Value == AnimatedNumber<FloatingPointFormatStyle<Double>> {
    /// A tile whose number rolls to each new value, in the locale's default number format.
    public init(label: String, value: Double, unit: String? = nil, delta: StatDelta? = nil) {
        self.init(label: label, content: AnimatedNumber(value), unit: unit, delta: delta)
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
                delta: StatDelta("+5 lb", tone: .success, symbol: "arrow.up")
            )
        }
        .padding()
        .background(theme.palette.canvas)
    }
}

#Preview("Stat tile") { StatTilePreviews() }
#Preview("Stat tile, dark") { StatTilePreviews().preferredColorScheme(.dark) }
#Preview("Stat tile, AX3") { StatTilePreviews().dynamicTypeSize(.accessibility3) }
