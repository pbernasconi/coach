import Foundation
import KoboTokens
import SwiftUI

/// A small toned capsule naming a status: always a glyph and a label, never colour alone.
///
///     StatusPill("Completed", tone: .success)
public struct StatusPill: View {
    private let label: Text
    private let tone: Tone
    private let symbol: String?
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// - Parameter symbol: an SF Symbol; `nil` uses the tone's glyph.
    public init(_ label: LocalizedStringKey, tone: Tone, symbol: String? = nil) {
        self.label = Text(label)
        self.tone = tone
        self.symbol = symbol
    }

    /// The On or Off pill of a setting: success with "On", neutral with "Off" (the library's own words).
    public init(isOn: Bool) {
        self.label = isOn ? Text("On", bundle: .module) : Text("Off", bundle: .module)
        self.tone = isOn ? .success : .neutral
        self.symbol = isOn ? "checkmark.circle.fill" : "minus.circle.fill"
    }

    /// A pill whose label is shown as is (user data, numbers).
    public init(verbatim label: String, tone: Tone, symbol: String? = nil) {
        self.label = Text(verbatim: label)
        self.tone = tone
        self.symbol = symbol
    }

    public var body: some View {
        let colors = theme.palette.status(tone)
        HStack(spacing: Space.xs) {
            Image(systemName: symbol ?? tone.feedbackSymbol)
                .imageScale(.small)
                .accessibilityHidden(true)
            label
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? 2 : 1)
        }
        .font(theme.font(.caption).weight(.semibold))
        .foregroundStyle(colors.ink)
        .padding(.horizontal, Space.sm)
        .padding(.vertical, Space.xs)
        .background(colors.soft, in: Capsule())
        .accessibilityElement(children: .combine)
    }
}

private struct StatusPillPreviews: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            ForEach(Tone.allCases, id: \.rawValue) { tone in
                StatusPill(verbatim: tone.rawValue.capitalized, tone: tone)
            }
            StatusPill("Personal record", tone: .accent, symbol: "trophy.fill")
            StatusPill(isOn: true)
            StatusPill(isOn: false)
        }
        .padding()
    }
}

#if DEBUG
    #Preview("Status pill") { StatusPillPreviews() }
    #Preview("Status pill, dark") { StatusPillPreviews().preferredColorScheme(.dark) }
    #Preview("Status pill, AX3") { StatusPillPreviews().dynamicTypeSize(.accessibility3) }
#endif
