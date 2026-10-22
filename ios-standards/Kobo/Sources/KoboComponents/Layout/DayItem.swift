import Foundation
import KoboTokens

/// What a day in a `DayStrip` shows under or behind its number. Never colour alone: done days are
/// filled, planned days carry a dot, and VoiceOver says which.
public nonisolated enum DayMarker: Hashable, Sendable {
    /// Nothing scheduled.
    case none
    /// Something is planned: a dot in the tone.
    case planned(Tone)
    /// Completed: the number sits on a filled circle in the tone.
    case done(Tone)
    /// One dot per thing on the day, each in its own colour (a category's colour): filled once done, a ring while
    /// still to do. At most three show. VoiceOver says "Done" when every one is done, else "Planned".
    case dots([DayDot])
}

/// One dot of a `DayMarker.dots` day: its colour as 0xRRGGBB for light and dark mode (a category's colour, from the
/// app's design file) and whether it is done (filled) or still to do (a ring).
public nonisolated struct DayDot: Hashable, Sendable {
    public var light: UInt32
    public var dark: UInt32
    public var isDone: Bool

    public init(light: UInt32, dark: UInt32, isDone: Bool) {
        self.light = light
        self.dark = dark
        self.isDone = isDone
    }
}

nonisolated extension DayMarker {
    /// The word VoiceOver adds for the marker, or nil for none.
    var spokenState: DayMarkerState? {
        switch self {
        case .none: nil
        case .planned: .planned
        case .done: .done
        case .dots(let dots): dots.isEmpty ? nil : (dots.allSatisfy(\.isDone) ? .done : .planned)
        }
    }
}

nonisolated enum DayMarkerState { case planned, done }

/// One day of a `DayStrip`: a date, its marker, and optionally what VoiceOver reads for it.
///
///     DayItem(date: monday, marker: .done(.accent))
///     DayItem(date: tuesday, marker: .planned(.accent), accessibilityLabel: "Tuesday: Long walk planned")
public nonisolated struct DayItem: Identifiable, Hashable, Sendable {
    public var date: Date
    public var marker: DayMarker
    /// Read instead of the strip's own "Tuesday, October 20, Planned" (a server's ready-made text, or one that names
    /// what is planned). "Today" is still added on today.
    public var accessibilityLabel: String?

    public var id: Date { date }

    public init(date: Date, marker: DayMarker = .none, accessibilityLabel: String? = nil) {
        self.date = date
        self.marker = marker
        self.accessibilityLabel = accessibilityLabel
    }

    /// True when the item falls on the same calendar day as the injected `today`.
    public func isToday(_ today: Date, calendar: Calendar) -> Bool {
        calendar.isDate(date, inSameDayAs: today)
    }
}
