import KoboTokens
import SwiftUI

/// One tappable day of a `DayStrip`: the day number (ringed today, filled when done) above a planned dot.
struct DayStripCell: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var diameter = Size.buttonHeightCompact
    @ScaledMetric(relativeTo: .body) private var dotSize = Space.xs + Space.xxs
    let dayNumber: String
    let marker: DayMarker
    let isToday: Bool
    let isPast: Bool
    let accessibilityText: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: Space.xs) {
                Text(dayNumber)
                    .font(theme.font(.numeric))
                    .fontWeight(isToday ? .heavy : .semibold)
                    .lineLimit(1)
                    .minimumScaleFactor(DayStripCellMetrics.minimumScale)
                    .foregroundStyle(numberColor)
                    .frame(width: diameter, height: diameter)
                    .background { background }
                Circle()
                    .fill(dotColor)
                    .frame(width: dotSize, height: dotSize)
            }
            .frame(maxWidth: .infinity, minHeight: Size.minTouch)
            .padding(.vertical, Space.xxs)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(accessibilityText))
        .accessibilityShowsLargeContentViewer {
            Text(dayNumber)
        }
    }

    @ViewBuilder
    private var background: some View {
        switch marker {
        case .done(let tone):
            Circle().fill(fill(tone))
        case .none, .planned:
            if isToday {
                Circle().strokeBorder(theme.palette.accent, lineWidth: Space.xxs)
            }
        }
    }

    private var numberColor: Color {
        if case .done(let tone) = marker {
            return tone == .accent ? theme.palette.onAccent : theme.palette.surface
        }
        if isToday { return theme.palette.accentText }
        return isPast ? theme.palette.textTertiary : theme.palette.textPrimary
    }

    private var dotColor: Color {
        if case .planned(let tone) = marker { return fill(tone) }
        return .clear
    }

    private func fill(_ tone: Tone) -> Color {
        tone == .accent ? theme.palette.accent : theme.palette.status(tone).ink
    }
}

enum DayStripCellMetrics {
    /// How far a day number may shrink before it truncates (two-digit days in a narrow column).
    static let minimumScale: CGFloat = 0.6
}
