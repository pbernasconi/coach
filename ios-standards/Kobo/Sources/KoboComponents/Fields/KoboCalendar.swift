import KoboTokens
import SwiftUI

/// A month calendar: six weeks starting on the calendar's first weekday, previous and next month buttons that stop at
/// the bounds, and days that can carry a `DayMarker` (planned dot, done fill), so the same grid serves a date picker
/// and a history view. `today` is injected, never read from the clock; the calendar and its first weekday come from
/// `@Environment(\.calendar)`. Without a `maxDate` it pages up to 12 months past today. The `.compact` density is for a
/// calendar at the top of a screen: smaller days, only the weeks of the month, a small month title and no arrows; a
/// horizontal swipe (or VoiceOver's adjustable action on the title) pages the months.
///
///     KoboCalendar(selection: $date, today: today, bounds: DateBounds(minDate: today))
///     KoboCalendar(today: today, markers: trips.map { DayItem(date: $0.date, marker: .done(.accent)) }) { open($0) }
public struct KoboCalendar: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.calendar) private var calendar
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shownMonth: Date?
    private let selection: Date?
    private let today: Date
    private let bounds: DateBounds
    private let markers: [DayItem]
    private let density: KoboCalendarDensity
    private let onSelect: (Date) -> Void

    /// A picker: a tap selects the day (at midnight in the environment's calendar).
    public init(
        selection: Binding<Date?>,
        today: Date,
        bounds: DateBounds = DateBounds(),
        markers: [DayItem] = [],
        density: KoboCalendarDensity = .regular
    ) {
        self.init(today: today, selection: selection.wrappedValue, bounds: bounds, markers: markers, density: density) {
            selection.wrappedValue = $0
        }
    }

    /// A calendar that reports taps: a history view, a planner. `selection` highlights one day.
    public init(
        today: Date,
        selection: Date? = nil,
        bounds: DateBounds = DateBounds(),
        markers: [DayItem] = [],
        density: KoboCalendarDensity = .regular,
        onSelect: @escaping (Date) -> Void
    ) {
        self.today = today
        self.selection = selection
        self.bounds = bounds
        self.markers = markers
        self.density = density
        self.onSelect = onSelect
    }

    private var grid: MonthGrid { MonthGrid(calendar: calendar) }
    private var upper: Date { grid.upperBound(maxDate: bounds.maxDate, today: today) }
    private var currentMonth: Date {
        shownMonth ?? grid.clampMonth(selection ?? today, minDate: bounds.minDate, maxDate: upper)
    }

    public var body: some View {
        let month = currentMonth
        let markers = markerLookup
        VStack(spacing: isCompact ? Space.xs : Space.sm) {
            if isCompact { compactHeader(month) } else { header(month) }
            HStack(spacing: 0) {
                ForEach(Array(grid.weekdaySymbols().enumerated()), id: \.offset) { _, symbol in
                    Text(verbatim: symbol)
                        .font(theme.font(.caption).weight(.semibold))
                        .foregroundStyle(theme.palette.textSecondary)
                        .frame(maxWidth: .infinity)
                }
            }
            .accessibilityHidden(true)
            VStack(spacing: isCompact ? 0 : Space.sm) {
                ForEach(grid.weeks(of: month, fitted: isCompact), id: \.first) { week in
                    HStack(spacing: 0) {
                        ForEach(week, id: \.timeIntervalSinceReferenceDate) { day in
                            dayCell(day, month: month, marker: markers[day] ?? DayMarker.none)
                        }
                    }
                }
            }
            .contentShape(Rectangle())
            .simultaneousGesture(isCompact ? swipe(month) : nil)
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .koboFeedback(.selection, trigger: selection)
    }

    /// The caller's bounds with the paging limit as the last day.
    private var effectiveBounds: DateBounds {
        DateBounds(minDate: bounds.minDate, maxDate: upper, isDateDisabled: bounds.isDateDisabled)
    }

    private var markerLookup: [Date: DayMarker] {
        Dictionary(
            markers.map { (calendar.startOfDay(for: $0.date), $0.marker) },
            uniquingKeysWith: { _, last in last }
        )
    }

    private func header(_ month: Date) -> some View {
        HStack(spacing: Space.sm) {
            pager("chevron.left", label: Text("Previous month", bundle: .module), offset: -1, month: month)
                .disabled(!grid.canGoToPreviousMonth(month, minDate: bounds.minDate))
            Text(verbatim: month.formatted(monthTitleStyle))
                .font(theme.font(.headline))
                .foregroundStyle(theme.palette.textPrimary)
                .frame(maxWidth: .infinity)
                .contentTransition(.opacity)
                .accessibilityAddTraits(.isHeader)
            pager("chevron.right", label: Text("Next month", bundle: .module), offset: 1, month: month)
                .disabled(!grid.canGoToNextMonth(month, maxDate: upper))
        }
        .koboAnimation(.crossfade, value: month)
    }

    private var isCompact: Bool { density == .compact }

    /// The compact title: the month in small type on the leading edge; VoiceOver pages with swipe up and down on it.
    private func compactHeader(_ month: Date) -> some View {
        Text(verbatim: month.formatted(monthTitleStyle))
            .font(theme.font(.subheadline).weight(.semibold))
            .foregroundStyle(theme.palette.textSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentTransition(.opacity)
            .koboAnimation(.crossfade, value: month)
            .accessibilityAddTraits(.isHeader)
            .accessibilityAdjustableAction { direction in
                switch direction {
                case .increment: page(month, by: 1)
                case .decrement: page(month, by: -1)
                @unknown default: break
                }
            }
    }

    /// A horizontal swipe pages the months: left for the next one, right for the previous one.
    private func swipe(_ month: Date) -> some Gesture {
        DragGesture(minimumDistance: Space.lg).onEnded { drag in
            guard abs(drag.translation.width) > abs(drag.translation.height),
                abs(drag.translation.width) > Size.minTouch
            else { return }
            page(month, by: drag.translation.width < 0 ? 1 : -1)
        }
    }

    /// Moves `by` months, within the bounds.
    private func page(_ month: Date, by offset: Int) {
        let canPage =
            offset > 0
            ? grid.canGoToNextMonth(month, maxDate: upper) : grid.canGoToPreviousMonth(month, minDate: bounds.minDate)
        guard canPage else { return }
        withKoboAnimation(.crossfade, reduceMotion: reduceMotion) { shownMonth = grid.month(month, adding: offset) }
    }

    private func pager(_ systemImage: String, label: Text, offset: Int, month: Date) -> some View {
        IconButton(systemImage, label: label, style: .plain, size: .regular) {
            shownMonth = grid.month(month, adding: offset)
        }
        .flipsForRightToLeftLayoutDirection(true)
    }

    private func dayCell(_ day: Date, month: Date, marker: DayMarker) -> some View {
        let isToday = calendar.isDate(day, inSameDayAs: today)
        let isSelected = selection.map { calendar.isDate(day, inSameDayAs: $0) } ?? false
        let isDisabled = !effectiveBounds.isSelectable(day, calendar: calendar)
        return KoboCalendarDay(
            isCompact: isCompact,
            dayNumber: String(calendar.component(.day, from: day)),
            marker: marker,
            isToday: isToday,
            isSelected: isSelected,
            isInMonth: grid.isInMonth(day, month: month),
            isDisabled: isDisabled,
            accessibilityText: CalendarSpeech.label(day, isToday: isToday, marker: marker, calendar: calendar),
            action: { onSelect(calendar.startOfDay(for: day)) }
        )
    }

    private var monthTitleStyle: Date.FormatStyle {
        var style = Date.FormatStyle.dateTime.month(.wide).year()
        style.calendar = calendar
        style.timeZone = calendar.timeZone
        return style
    }
}

#if DEBUG
    private struct KoboCalendarGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var date: Date?
        private let today = Date(timeIntervalSinceReferenceDate: 813_744_000)  // a fixed Thursday

        private var history: [DayItem] {
            let calendar = Calendar.current
            func day(_ offset: Int) -> Date { calendar.date(byAdding: .day, value: offset, to: today) ?? today }
            return [
                DayItem(date: day(-9), marker: .done(.accent)),
                DayItem(date: day(-7), marker: .done(.accent)),
                DayItem(date: day(-2), marker: .done(.success)),
                DayItem(date: day(1), marker: .planned(.accent)),
                DayItem(date: day(3), marker: .planned(.info)),
            ]
        }

        var body: some View {
            ScrollView {
                VStack(spacing: Space.xxl) {
                    KoboCalendar(selection: $date, today: today, bounds: DateBounds(minDate: today))
                    KoboCalendar(today: today, markers: history) { date = $0 }
                    KoboCalendar(today: today, selection: date, markers: history, density: .compact) { date = $0 }
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Calendar") { KoboCalendarGallery() }
    #Preview("Calendar · dark, Amber") { KoboCalendarGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Calendar · AX3") { KoboCalendarGallery().dynamicTypeSize(.accessibility3) }
#endif

/// How much room a `KoboCalendar` takes: `.regular` for a picker, `.compact` for a calendar at the top of a screen.
public enum KoboCalendarDensity: Hashable, Sendable {
    case regular
    case compact
}
