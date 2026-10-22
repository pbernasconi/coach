import KoboTokens
import SwiftUI

/// One tappable day of a `DayStrip`: the day number (ringed today, filled when done, a soft disc or an outer ring when
/// selected) above a planned dot, or above a row of coloured dots. In the `.ink` highlight the selected day is a solid
/// ink disc and today an ink ring.
struct DayStripCell: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dayHighlight) private var highlight
    @ScaledMetric(relativeTo: .body) private var diameter = Size.buttonHeightCompact
    @ScaledMetric(relativeTo: .body) private var dotSize = Space.xs + Space.xxs
    let dayNumber: String
    let marker: DayMarker
    let isToday: Bool
    var isSelected = false
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
                if case .dots(let dots) = marker {
                    DayDots(dots: dots, size: Space.xs + Space.xxs)
                        .frame(height: dotSize)
                } else {
                    Circle()
                        .fill(dotColor)
                        .frame(width: dotSize, height: dotSize)
                }
            }
            .frame(maxWidth: .infinity, minHeight: Size.minTouch)
            .padding(.vertical, Space.xxs)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(accessibilityText))
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
        .koboAnimation(.state, value: isSelected)
        .accessibilityShowsLargeContentViewer {
            Text(dayNumber)
        }
    }

    @ViewBuilder
    private var background: some View {
        switch marker {
        case .done(let tone):
            Circle().fill(fill(tone))
                .padding(isSelected ? Space.xs : 0)
                .background { if isSelected { Circle().strokeBorder(theme.palette.textPrimary, lineWidth: Space.xxs) } }
        case .none, .planned, .dots:
            ZStack {
                if isSelected { Circle().fill(highlight == .ink ? colors.selectedFill : theme.palette.accentSoft) }
                if isToday && !(isSelected && highlight == .ink) {
                    Circle().strokeBorder(
                        colors.todayRing,
                        lineWidth: highlight == .ink ? Size.hairline * 3 : Space.xxs
                    )
                }
            }
        }
    }

    private var numberColor: Color {
        if case .done(let tone) = marker {
            return tone == .accent ? theme.palette.onAccent : theme.palette.surface
        }
        if isSelected && highlight == .ink { return colors.onSelected }
        if isToday || isSelected { return colors.todayText }
        return isPast ? theme.palette.textTertiary : theme.palette.textPrimary
    }

    private var dotColor: Color {
        if case .planned(let tone) = marker { return fill(tone) }
        return .clear
    }

    private var colors: DayHighlightColors { DayHighlightColors(highlight, palette: theme.palette) }

    private func fill(_ tone: Tone) -> Color {
        tone == .accent ? theme.palette.accent : theme.palette.status(tone).ink
    }
}

enum DayStripCellMetrics {
    /// How far a day number may shrink before it truncates (two-digit days in a narrow column).
    static let minimumScale: CGFloat = 0.6
}
