import KoboTokens
import SwiftUI

/// How `DayStrip` and `KoboCalendar` mark the selected day and today: in the theme's accent (the default), or in ink,
/// black on light and white on dark, so coloured day dots carry all the colour.
///
///     DayStrip(items: days, today: now, week: $week, selection: picked) { picked = $0 }
///         .dayHighlight(.ink)
public enum DayHighlight: Hashable, Sendable {
    case accent
    case ink
}

extension EnvironmentValues {
    @Entry var dayHighlight: DayHighlight = .accent
}

extension View {
    /// Marks the selected day and today of the day strips and calendars inside in ink instead of the accent.
    public func dayHighlight(_ highlight: DayHighlight) -> some View {
        environment(\.dayHighlight, highlight)
    }
}

/// The highlight colours one day reads: the selected day's fill and the number on it, today's ring and number.
struct DayHighlightColors {
    let selectedFill: Color
    let onSelected: Color
    let todayRing: Color
    let todayText: Color

    init(_ highlight: DayHighlight, palette: Palette) {
        switch highlight {
        case .accent:
            selectedFill = palette.accent
            onSelected = palette.onAccent
            todayRing = palette.accent
            todayText = palette.accentText
        case .ink:
            selectedFill = palette.textPrimary
            onSelected = palette.surface
            todayRing = palette.textPrimary
            todayText = palette.textPrimary
        }
    }
}

/// Up to three dots in a row under a day number: filled once done, a ring while still to do.
struct DayDots: View {
    let dots: [DayDot]
    let size: CGFloat

    var body: some View {
        HStack(spacing: size / 2) {
            ForEach(Array(dots.prefix(3).enumerated()), id: \.offset) { _, dot in
                let color = dot.color
                Group {
                    if dot.isDone {
                        Circle().fill(color)
                    } else {
                        Circle().strokeBorder(color, lineWidth: max(1, size / 4))
                    }
                }
                .frame(width: size, height: size)
            }
        }
        .frame(height: size)
        .accessibilityHidden(true)
    }
}

extension DayDot {
    /// The dot's colour, from the caller's own design file (passed in as data, so no token applies).
    var color: Color { Color(light: Color(hex: light), dark: Color(hex: dark)) }  // ios-guard: allow caller's colour
}
