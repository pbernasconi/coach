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
}

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
