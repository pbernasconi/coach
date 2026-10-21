import Foundation

/// What VoiceOver reads for one day of a `DayStrip`: the item's own label, or the full date and its marker
/// ("Tuesday, October 20, Planned"), with "Today" added on today.
nonisolated enum DayStripSpeech {
    static func text(for day: DayItem, isToday: Bool, calendar: Calendar) -> String {
        var parts: [String]
        if let label = day.accessibilityLabel, !label.isEmpty {
            parts = [label]
        } else {
            var style = Date.FormatStyle.dateTime.weekday(.wide).month(.wide).day()
            style.calendar = calendar
            style.timeZone = calendar.timeZone
            parts = [day.date.formatted(style)]
            switch day.marker {
            case .none: break
            case .planned: parts.append(String(localized: "Planned", bundle: .module))
            case .done: parts.append(String(localized: "Done", bundle: .module))
            }
        }
        if isToday { parts.insert(String(localized: "Today", bundle: .module), at: 1) }
        return parts.joined(separator: ", ")
    }
}
