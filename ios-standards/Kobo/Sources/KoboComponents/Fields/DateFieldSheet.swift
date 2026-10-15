import KoboTokens
import SwiftUI

/// The calendar sheet of a `DateField`: a title and close button, optional quick picks ("Today", "Tomorrow" or the
/// earliest day), and a `KoboCalendar`. A pick lands at the tap; the sheet closes a moment later
/// (`Motion.Duration.pickHold`), so the day's fill shows first.
struct DateFieldSheet: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.calendar) private var calendar
    @Environment(\.dismiss) private var dismiss
    @State private var landed: Date?
    let title: Text
    let selection: Date?
    let today: Date
    let bounds: DateBounds
    let showsQuickPicks: Bool
    var clock: any Clock<Duration> = ContinuousClock()
    let pick: (Date) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            HStack(spacing: Space.sm) {
                title
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityAddTraits(.isHeader)
                CloseButton { dismiss() }
            }
            if showsQuickPicks {
                FlowLayout(spacing: Space.sm, lineSpacing: 0) {
                    ForEach(DateQuickPick.picks(today: today, bounds: bounds, calendar: calendar)) { item in
                        Chip(title: chipTitle(item), systemImage: nil, tone: .accent, isSelected: isSelected(item)) {
                            choose(item.date)
                        }
                    }
                }
            }
            KoboCalendar(today: today, selection: landed ?? selection, bounds: bounds, onSelect: choose)
        }
        .padding(Space.gutter)
        .allowsHitTesting(landed == nil)
        .presentationDetents([.medium, .large])
        .task(id: landed) {
            guard landed != nil else { return }
            do {
                try await clock.sleep(for: .seconds(Motion.Duration.pickHold))
            } catch {
                return
            }
            dismiss()
        }
    }

    private func choose(_ date: Date) {
        landed = date
        pick(date)
    }

    private func isSelected(_ item: DateQuickPick) -> Bool {
        guard let current = landed ?? selection else { return false }
        return calendar.isDate(current, inSameDayAs: item.date)
    }

    private func chipTitle(_ item: DateQuickPick) -> Text {
        switch item {
        case .today: Text("Today", bundle: .module)
        case .tomorrow: Text("Tomorrow", bundle: .module)
        case .earliest(let date):
            Text("Earliest: \(date.formatted(.dateTime.month(.abbreviated).day()))", bundle: .module)
        }
    }
}
