import KoboTokens
import SwiftUI

/// One day of a `KoboCalendar`: the number in a circle, filled when selected, filled in its tone when done, ringed
/// when it is today, with a dot under it when planned. Days outside the month are muted; unavailable days are muted
/// and struck through, so they never read by colour alone.
struct KoboCalendarDay: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dayHighlight) private var highlight
    @ScaledMetric(relativeTo: .body) private var regularDiameter = Size.minTouch
    @ScaledMetric(relativeTo: .subheadline) private var compactDiameter = Size.iconLg + Space.sm
    @ScaledMetric(relativeTo: .body) private var dotSize = Space.xs + Space.xxs
    /// Smaller numbers and circles with the dot tucked under them, in a row one touch target high.
    let isCompact: Bool
    let dayNumber: String
    let marker: DayMarker
    let isToday: Bool
    let isSelected: Bool
    let isInMonth: Bool
    let isDisabled: Bool
    let accessibilityText: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: isCompact ? 0 : Space.xxs) {
                Text(verbatim: dayNumber)
                    .font(isCompact ? theme.font(.subheadline).monospacedDigit() : theme.font(.numeric))
                    .fontWeight(isSelected || isToday ? .bold : .regular)
                    .strikethrough(isDisabled && isInMonth)
                    .lineLimit(1)
                    .minimumScaleFactor(KoboCalendarDayMetrics.minimumScale)
                    .foregroundStyle(numberColor)
                    .frame(width: diameter, height: diameter)
                    .background { background }
                if case .dots(let dots) = marker {
                    DayDots(dots: dots, size: Space.xs + Space.xxs / 2)
                } else {
                    Circle()
                        .fill(dotColor)
                        .frame(width: isCompact ? Space.xs : dotSize, height: isCompact ? Space.xs : dotSize)
                }
            }
            .frame(maxWidth: .infinity, minHeight: Size.minTouch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .koboAnimation(.state, value: isSelected)
        .accessibilityLabel(Text(verbatim: accessibilityText))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
        .accessibilityShowsLargeContentViewer {
            Text(verbatim: dayNumber)
        }
    }

    private var colors: DayHighlightColors { DayHighlightColors(highlight, palette: theme.palette) }

    private var diameter: CGFloat { isCompact ? compactDiameter : regularDiameter }

    @ViewBuilder
    private var background: some View {
        if isSelected {
            Circle().fill(colors.selectedFill)
        } else if case .done(let tone) = marker {
            Circle().fill(tone == .accent ? theme.palette.accentSoft : theme.palette.status(tone).soft)
        } else if isToday {
            Circle().strokeBorder(colors.todayRing, lineWidth: highlight == .ink ? Size.hairline * 3 : Space.xxs)
        }
    }

    private var numberColor: Color {
        if isSelected { return colors.onSelected }
        if isDisabled || !isInMonth { return theme.palette.textTertiary }
        if case .done(let tone) = marker {
            return tone == .accent ? theme.palette.accentText : theme.palette.status(tone).ink
        }
        return isToday ? colors.todayText : theme.palette.textPrimary
    }

    private var dotColor: Color {
        guard case .planned(let tone) = marker else { return .clear }
        return tone == .accent ? theme.palette.accent : theme.palette.status(tone).ink
    }
}

enum KoboCalendarDayMetrics {
    /// How far a day number may shrink before it truncates (two-digit days in a narrow column).
    static let minimumScale: CGFloat = 0.6
}

/// What VoiceOver reads for a calendar day: "Friday, July 24, 2026, Today, Done".
enum CalendarSpeech {
    static func label(_ day: Date, isToday: Bool, marker: DayMarker, calendar: Calendar) -> String {
        var style = Date.FormatStyle.dateTime.weekday(.wide).month(.wide).day().year()
        style.calendar = calendar
        style.timeZone = calendar.timeZone
        var parts = [day.formatted(style)]
        if isToday { parts.append(String(localized: "Today", bundle: .module)) }
        switch marker.spokenState {
        case nil: break
        case .planned: parts.append(String(localized: "Planned", bundle: .module))
        case .done: parts.append(String(localized: "Done", bundle: .module))
        }
        return parts.joined(separator: ", ")
    }
}
