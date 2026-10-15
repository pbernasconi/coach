import KoboTokens
import SwiftUI

/// A date field: type the date in the region's order on a number pad ("07/24/2026", "24.07.2026"), paste one in
/// almost any common form, or open a calendar sheet. A complete date the bounds refuse shows an error and reports
/// `nil`; it is never moved to the nearest allowed day. A partial date reports nothing and, on blur, goes back to
/// the held date. `today` is injected, never read from the clock; the calendar comes from `@Environment(\.calendar)`.
///
///     DateField("Start date", selection: $start, today: today, bounds: DateBounds(minDate: today), quickPicks: true)
public struct DateField: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.calendar) private var calendar
    @Environment(\.locale) private var locale
    @FocusState private var isFocused: Bool
    @State private var field: DateFieldText?
    @State private var isCalendarOpen = false
    private var label: Text
    private let selection: Binding<Date?>
    private let today: Date
    private let bounds: DateBounds
    private let quickPicks: Bool
    private let messages: DateFieldMessages?
    private let showsCalendar: Bool
    private var focusLink: FieldFocusLink?

    /// - Parameters:
    ///   - quickPicks: offers "Today" and "Tomorrow" (or the earliest allowed day) above the calendar.
    ///   - messages: the error lines; the library's own when `nil`.
    ///   - showsCalendar: `false` keeps the typed field only, for a field already inside a sheet.
    public init(
        _ label: LocalizedStringKey,
        selection: Binding<Date?>,
        today: Date,
        bounds: DateBounds = DateBounds(),
        quickPicks: Bool = false,
        messages: DateFieldMessages? = nil,
        showsCalendar: Bool = true
    ) {
        self.label = Text(label)
        self.selection = selection
        self.today = today
        self.bounds = bounds
        self.quickPicks = quickPicks
        self.messages = messages
        self.showsCalendar = showsCalendar
    }

    /// A field whose label is shown as is.
    public init(
        verbatim label: String,
        selection: Binding<Date?>,
        today: Date,
        bounds: DateBounds = DateBounds(),
        quickPicks: Bool = false,
        messages: DateFieldMessages? = nil,
        showsCalendar: Bool = true
    ) {
        self.init(
            "",
            selection: selection,
            today: today,
            bounds: bounds,
            quickPicks: quickPicks,
            messages: messages,
            showsCalendar: showsCalendar
        )
        self.label = Text(verbatim: label)
    }

    public var body: some View {
        let state = current
        let evaluation = state.evaluate(bounds)
        let error = DateFieldLogic.errorMessage(evaluation, messages: messages ?? .standard).map(FieldError.message)
        let helper = helperText(evaluation, pattern: state.pattern)
        FieldFrame(label: label, helper: helper, error: error ?? .none, isFocused: isFocused, value: state.text) {
            TextField(text: textBinding, prompt: Text(verbatim: state.pattern.hint).foregroundStyle(hintColor)) {
                label
            }
            .labelsHidden()
            .monospacedDigit()
            .focused($isFocused)
            .numberPad(allowsDecimal: false)
            .keyboardAccessoryBar(onDone: { isFocused = false })
            .fieldAccessibility(label: label, value: state.text, helper: helper, error: error ?? .none)
            if showsCalendar { calendarButton }
        }
        .onAppear { if field == nil { field = state } }
        .onChange(of: isFocused) { _, focused in
            if !focused { update { $0.blurred(held: selection.wrappedValue) } }
        }
        .onChange(of: selection.wrappedValue) { _, date in update { $0.sync(date) } }
        .onChange(of: [bounds.minDate, bounds.maxDate]) { edit { $0.settle(bounds) } }
        .sheet(isPresented: $isCalendarOpen) {
            DateFieldSheet(
                title: label,
                selection: selection.wrappedValue,
                today: today,
                bounds: bounds,
                showsQuickPicks: quickPicks
            ) { date in edit { $0.pick(date) } }
        }
        .fieldFocusSync(focusLink, isFocused: $isFocused)
    }

    private var calendarButton: some View {
        FieldIconButton(systemImage: "calendar", label: Text("Open calendar", bundle: .module)) {
            isCalendarOpen = true
        }
        .padding(.trailing, -Space.md)
        .accessibilityValue(selectedSpoken)
    }

    private var hintColor: Color { theme.palette.textTertiary }

    /// The state: the edited one, or a fresh one over the caller's date before the first render settles.
    private var current: DateFieldText {
        field
            ?? DateFieldText(
                value: selection.wrappedValue,
                pattern: DateFieldPattern(locale: locale),
                calendar: calendar
            )
    }

    private var textBinding: Binding<String> {
        Binding(
            get: { current.text },
            set: { new in
                edit { state in
                    state.text = new
                    state.normalize()
                    return state.settle(bounds)
                }
            }
        )
    }

    /// "Jul 24, 2026" once the text is a complete valid date; the typed shape before.
    private func helperText(_ evaluation: DateFieldLogic.Evaluation, pattern: DateFieldPattern) -> Text {
        guard case .valid(let date) = evaluation else { return Text("Format: \(pattern.hint)", bundle: .module) }
        return Text(verbatim: date.formatted(spelledStyle))
    }

    private var selectedSpoken: Text {
        guard let date = selection.wrappedValue else { return Text("No date selected", bundle: .module) }
        return Text(verbatim: date.formatted(spelledStyle))
    }

    private var spelledStyle: Date.FormatStyle {
        var style = Date.FormatStyle.dateTime.month(.abbreviated).day().year()
        style.calendar = calendar
        style.timeZone = calendar.timeZone
        return style
    }

    private func edit(_ body: (inout DateFieldText) -> DateFieldText.Change?) {
        var next = current
        let change = body(&next)
        field = next
        if let change { selection.wrappedValue = change.date }
    }

    private func update(_ body: (inout DateFieldText) -> Void) {
        var next = current
        body(&next)
        field = next
    }
}

extension DateField {
    /// Links this field to a screen's `Bool` focus state.
    public func focused(by binding: FocusState<Bool>.Binding) -> DateField {
        var field = self
        field.focusLink = .bool(binding)
        return field
    }

    /// Links this field to one case of a screen's focus enum.
    public func focused<Value: Hashable>(by binding: FocusState<Value?>.Binding, equals value: Value) -> DateField {
        var field = self
        field.focusLink = .value(binding, equals: value)
        return field
    }
}

#if DEBUG
    private struct DateFieldGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var start: Date?
        @State private var birthday: Date?
        private let today = Date(timeIntervalSinceReferenceDate: 813_744_000)  // a fixed Thursday

        var body: some View {
            ScrollView {
                VStack(spacing: Space.lg) {
                    DateField(
                        "Start date",
                        selection: $start,
                        today: today,
                        bounds: DateBounds(minDate: today),
                        quickPicks: true
                    )
                    DateField("Birthday", selection: $birthday, today: today, bounds: DateBounds(maxDate: today))
                    DateField("In a sheet", selection: $start, today: today, showsCalendar: false)
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Date field") { DateFieldGallery() }
    #Preview("Date field · dark, Amber") { DateFieldGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Date field · AX3") { DateFieldGallery().dynamicTypeSize(.accessibility3) }
    #Preview("Date field · German") { DateFieldGallery().environment(\.locale, Locale(identifier: "de_DE")) }
#endif
