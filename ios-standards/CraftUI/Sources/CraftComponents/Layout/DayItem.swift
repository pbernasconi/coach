import CraftTokens
import Foundation

/// What a day in a `DayStrip` shows under or behind its number. Never colour alone: done days are
/// filled, planned days carry a dot, and VoiceOver says which.
public nonisolated enum DayMarker: Hashable, Sendable {
    /// Nothing scheduled.
    case none
    /// Something is planned: a dot in the tone.
    case planned(Tone)
    /// Completed: the number sits on a filled circle in the tone.
    case done(Tone)
}

/// One day of a `DayStrip`: a date and its marker.
///
///     DayItem(date: monday, marker: .done(.accent))
public nonisolated struct DayItem: Identifiable, Hashable, Sendable {
    public var date: Date
    public var marker: DayMarker

    public var id: Date { date }

    public init(date: Date, marker: DayMarker = .none) {
        self.date = date
        self.marker = marker
    }

    /// True when the item falls on the same calendar day as the injected `today`.
    public func isToday(_ today: Date, calendar: Calendar) -> Bool {
        calendar.isDate(date, inSameDayAs: today)
    }
}
