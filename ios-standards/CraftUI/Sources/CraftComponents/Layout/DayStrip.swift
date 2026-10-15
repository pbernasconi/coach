import CraftTokens
import Foundation
import SwiftUI

/// A week strip: weekday letters over seven day numbers, paged horizontally one week at a time.
/// Today has a ring, done days a filled circle, planned days a dot. `week` is the visible page as an
/// offset from the week containing `today` (0 = this week, -1 = last week); swiping updates it and
/// setting it scrolls. The first weekday comes from `@Environment(\.calendar)`.
///
///     DayStrip(items: days, today: now, week: $week) { date in open(date) }
///
/// Day numbers stop growing at `.xxxLarge` so seven columns always fit; long-press shows the large
/// content viewer and VoiceOver reads the full date.
public struct DayStrip: View {
    @Environment(\.craftTheme) private var theme
    @Environment(\.calendar) private var calendar
    @Binding private var week: Int
    private let items: [DayItem]
    private let today: Date
    private let weeks: ClosedRange<Int>
    private let onSelect: (Date) -> Void

    /// - Parameters:
    ///   - items: days with markers; days without an item show no marker.
    ///   - today: the injected current date (never read from the clock here).
    ///   - week: the visible week offset.
    ///   - weeks: the pageable range of week offsets.
    public init(
        items: [DayItem],
        today: Date,
        week: Binding<Int>,
        weeks: ClosedRange<Int> = -4...4,
        onSelect: @escaping (Date) -> Void
    ) {
        self.items = items
        self.today = today
        self._week = week
        self.weeks = weeks
        self.onSelect = onSelect
    }

    private var math: WeekMath { WeekMath(calendar: calendar) }

    public var body: some View {
        VStack(spacing: Space.xs) {
            weekdayHeader
            ScrollView(.horizontal) {
                LazyHStack(spacing: 0) {
                    ForEach(math.pages(weeks: weeks, today: today, items: items)) { page in
                        weekRow(page)
                            .containerRelativeFrame(.horizontal)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollTargetBehavior(.paging)
            .scrollIndicators(.hidden)
            .scrollPosition(id: Binding<Int?>($week))
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }

    private var weekdayHeader: some View {
        HStack(spacing: 0) {
            ForEach(Array(math.weekdaySymbols().enumerated()), id: \.offset) { _, symbol in
                Text(symbol)
                    .font(theme.font(.caption).weight(.bold))
                    .foregroundStyle(theme.palette.textSecondary)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, Space.sm)
        .accessibilityHidden(true)
    }

    private func weekRow(_ page: WeekPage) -> some View {
        HStack(spacing: 0) {
            ForEach(page.days) { day in
                let isToday = day.isToday(today, calendar: calendar)
                DayStripCell(
                    dayNumber: String(calendar.component(.day, from: day.date)),
                    marker: day.marker,
                    isToday: isToday,
                    isPast: math.isPast(day.date, today: today),
                    accessibilityText: accessibilityText(for: day, isToday: isToday),
                    action: { onSelect(day.date) }
                )
            }
        }
        .padding(.horizontal, Space.sm)
    }

    private func accessibilityText(for day: DayItem, isToday: Bool) -> String {
        var style = Date.FormatStyle.dateTime.weekday(.wide).month(.wide).day()
        style.calendar = calendar
        style.timeZone = calendar.timeZone
        var parts = [day.date.formatted(style)]
        if isToday { parts.append(String(localized: "Today", bundle: .module)) }
        switch day.marker {
        case .none: break
        case .planned: parts.append(String(localized: "Planned", bundle: .module))
        case .done: parts.append(String(localized: "Done", bundle: .module))
        }
        return parts.joined(separator: ", ")
    }
}

#if DEBUG
    private struct DayStripPreview: View {
        @State private var week = 0
        @State private var selected: Date?
        private let today = Date(timeIntervalSinceReferenceDate: 813_744_000)  // a fixed Thursday

        private var items: [DayItem] {
            let calendar = Calendar.current
            func day(_ offset: Int) -> Date { calendar.date(byAdding: .day, value: offset, to: today) ?? today }
            return [
                DayItem(date: day(-3), marker: .done(.accent)),
                DayItem(date: day(-1), marker: .done(.success)),
                DayItem(date: day(0), marker: .planned(.accent)),
                DayItem(date: day(2), marker: .planned(.info)),
                DayItem(date: day(-8), marker: .done(.accent)),
            ]
        }

        var body: some View {
            VStack(spacing: Space.lg) {
                DayStrip(items: items, today: today, week: $week) { selected = $0 }
                    .padding(.vertical, Space.md)
                    .craftCard(padding: 0)
                Text("Week offset \(week)")
                Text(selected.map { $0.formatted(date: .abbreviated, time: .omitted) } ?? "No day selected")
            }
            .padding(Space.gutter)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(Theme.system.palette.canvas)
        }
    }

    #Preview("Light") { DayStripPreview() }
    #Preview("Dark") { DayStripPreview().preferredColorScheme(.dark) }
    #Preview("AX3") { DayStripPreview().dynamicTypeSize(.accessibility3) }
    #Preview("Monday first") {
        DayStripPreview().environment(
            \.calendar,
            {
                var calendar = Calendar(identifier: .gregorian)
                calendar.firstWeekday = 2
                return calendar
            }()
        )
    }
#endif
