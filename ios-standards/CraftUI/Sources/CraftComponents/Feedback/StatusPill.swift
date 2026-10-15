import CraftTokens
import Foundation
import SwiftUI

/// A small toned capsule naming a status: always a glyph and a label, never colour alone.
///
///     StatusPill("Completed", tone: .success)
public struct StatusPill: View {
    private let label: String
    private let tone: Tone
    private let symbol: String?
    @Environment(\.craftTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// - Parameter symbol: an SF Symbol; `nil` uses the tone's glyph.
    public init(_ label: String, tone: Tone, symbol: String? = nil) {
        self.label = label
        self.tone = tone
        self.symbol = symbol
    }

    public var body: some View {
        let colors = theme.palette.status(tone)
        HStack(spacing: Space.xs) {
            Image(systemName: symbol ?? tone.feedbackSymbol)
                .imageScale(.small)
                .accessibilityHidden(true)
            Text(label)
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
                StatusPill(tone.rawValue.capitalized, tone: tone)
            }
            StatusPill("Personal record", tone: .accent, symbol: "trophy.fill")
        }
        .padding()
    }
}

#Preview("Status pill") { StatusPillPreviews() }
#Preview("Status pill, dark") { StatusPillPreviews().preferredColorScheme(.dark) }
#Preview("Status pill, AX3") { StatusPillPreviews().dynamicTypeSize(.accessibility3) }
