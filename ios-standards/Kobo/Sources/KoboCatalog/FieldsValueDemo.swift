import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Live demos for the Fields section's value controls: date entry, the month calendar, copying and the keyboard bar.
struct FieldsValueDemo: View {
    let component: CatalogComponent
    @State private var due: Date?
    @State private var picked: Date?
    @State private var today = Date.now  // ios-guard: allow catalog demo reads the clock once
    @Environment(\.calendar) private var calendar

    var body: some View {
        switch component {
        case .dateField:
            VStack(spacing: Space.lg) {
                DateField(
                    "Due date",
                    selection: $due,
                    today: today,
                    bounds: DateBounds(minDate: today),
                    quickPicks: true
                )
                DateField(verbatim: "Start date", selection: $picked, today: today, showsCalendar: false)
            }
        case .calendar:
            KoboCalendar(selection: $picked, today: today, markers: markers)
        case .copyButton:
            HStack {
                Text(verbatim: "example.com/invite/4F7K")
                CopyButton(value: "https://example.com/invite/4F7K", what: "invite link")
            }
        case .copyableValue:
            VStack(alignment: .leading, spacing: Space.lg) {
                CopyableValue("Reference", value: "ORD-2048-17", what: "reference")
                CopyableValue(verbatim: "Room code", value: "TULIP-42", maskedValue: "••••-42", revealable: true)
                CopyableValue("Short code", value: "Q7R2", layout: .row)
            }
        case .keyboardAccessoryBar:
            VStack(spacing: Space.md) {
                KeyboardAccessoryBar(onDone: {})
                KeyboardAccessoryBar(onPrevious: {}, onNext: {}, onDone: {})
            }
        default: EmptyView()
        }
    }

    private var markers: [DayItem] {
        [-3, -1, 2].compactMap { offset in
            calendar.date(byAdding: .day, value: offset, to: today).map { date in
                DayItem(date: date, marker: offset < 0 ? .done(.success) : .planned(.accent))
            }
        }
    }
}
