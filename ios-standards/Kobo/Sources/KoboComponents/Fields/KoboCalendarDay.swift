import KoboTokens
import SwiftUI

/// One day of a `KoboCalendar`: the number in a circle, filled when selected, filled in its tone when done, ringed
/// when it is today, with a dot under it when planned. Days outside the month are muted; unavailable days are muted
/// and struck through, so they never read by colour alone.
struct KoboCalendarDay: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var diameter = Size.minTouch
    @ScaledMetric(relativeTo: .body) private var dotSize = Space.xs + Space.xxs
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
            VStack(spacing: Space.xxs) {
                Text(verbatim: dayNumber)
                    .font(theme.font(.numeric))
                    .fontWeight(isSelected || isToday ? .bold : .regular)
                    .strikethrough(isDisabled && isInMonth)
                    .lineLimit(1)
                    .minimumScaleFactor(KoboCalendarDayMetrics.minimumScale)
                    .foregroundStyle(numberColor)
                    .frame(width: diameter, height: diameter)
                    .background { background }
                Circle()
                    .fill(dotColor)
                    .frame(width: dotSize, height: dotSize)
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

    @ViewBuilder
    private var background: some View {
        if isSelected {
            Circle().fill(theme.palette.accent)
        } else if case .done(let tone) = marker {
            Circle().fill(tone == .accent ? theme.palette.accentSoft : theme.palette.status(tone).soft)
        } else if isToday {
            Circle().strokeBorder(theme.palette.accent, lineWidth: Space.xxs)
        }
    }

    private var numberColor: Color {
        if isSelected { return theme.palette.onAccent }
        if isDisabled || !isInMonth { return theme.palette.textTertiary }
        if case .done(let tone) = marker { return tone == .accent ? theme.palette.accentText : theme.palette.status(tone).ink }
        return isToday ? theme.palette.accentText : theme.palette.textPrimary
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
        switch marker {
        case .none: break
        case .planned: parts.append(String(localized: "Planned", bundle: .module))
        case .done: parts.append(String(localized: "Done", bundle: .module))
        }
        return parts.joined(separator: ", ")
    }
}
