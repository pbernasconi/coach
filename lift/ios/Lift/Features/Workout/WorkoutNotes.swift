import KoboComponents
import KoboTokens
import SwiftUI

/// What was written for the whole session, under the Workout header: its warm-up and its note (for example from an
/// imported Apple Note). Draws nothing when there are none.
struct WorkoutSessionNotes: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .footnote) private var iconWidth = Size.iconSm
    let note: String?
    let warmUpNote: String?

    var body: some View {
        if note != nil || warmUpNote != nil {
            VStack(alignment: .leading, spacing: Space.xxs) {
                line(warmUpNote.map { String(localized: "Warm-up: \($0)") }, symbol: "flame")
                line(note, symbol: "quote.bubble")
            }
            .font(theme.font(.footnote))
            .foregroundStyle(theme.palette.textSecondary)
        }
    }

    @ViewBuilder
    private func line(_ text: String?, symbol: String) -> some View {
        if let text {
            HStack(alignment: .firstTextBaseline, spacing: Space.xs) {
                Image(systemName: symbol)
                    .symbolVariant(.fill)
                    .imageScale(.small)
                    .frame(width: iconWidth)
                    .accessibilityHidden(true)
                Text(verbatim: text)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

/// A set's note under its row in the set grid ("paused"), lined up with the Previous column.
struct SetNoteLine: View {
    @Environment(\.koboTheme) private var theme
    let note: String
    /// The badge column's width plus its gap, so the note starts where Previous does; 0 when the row is stacked.
    let indent: CGFloat

    var body: some View {
        Text(verbatim: note)
            .font(theme.font(.footnote))
            .foregroundStyle(theme.palette.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, indent)
            .accessibilityLabel(Text("Note: \(note)"))
    }
}
