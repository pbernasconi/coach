import KoboTokens
import SwiftUI

/// The big-number editor: a centred hero value with its unit, optional − and + step buttons, a caption or error, and
/// either the system number pad (`.keyboard`) or an on-screen keypad (`.keypad`). Typing follows the region's decimal
/// separator and grouping. An edit above the range is refused with a shake and the error haptic; a value below it is
/// kept while typing and raised on commit (Done, focus loss, a step, or leaving the screen).
///
///     NumberEntry("Distance", value: $distance, in: 0...1000, decimalPlaces: 1, step: 2.5, unit: "km", input: .keypad)
///     NumberEntry("Guests", value: $guests, in: 1...50, step: 1)
public struct NumberEntry: View {
    /// How the user types the number.
    public enum Input: Sendable, Hashable {
        /// The system number or decimal pad, with a Done bar.
        case keyboard
        /// An on-screen keypad under the value, for screens that stay open (a scorekeeper or a till).
        case keypad
    }

    @Environment(\.koboTheme) private var theme
    @Environment(\.locale) private var locale
    @FocusState private var isFocused: Bool
    @State private var field: NumberEntryText?
    @State private var shakes = 0
    /// Internal so the `verbatim:` initialisers in NumberEntryVerbatim.swift can set it.
    var label: Text
    private let value: Binding<Double?>
    private let rules: NumberEntryRules
    private let step: Double?
    private let unit: Text?
    private let caption: Text?
    private let error: FieldError
    private let input: Input

    /// An editor over an optional number: `nil` while the field is empty.
    ///
    /// - Parameters:
    ///   - range: the allowed values; the upper bound also caps how many whole digits can be typed.
    ///   - decimalPlaces: fraction digits the user may type (0 for whole numbers).
    ///   - step: adds − and + buttons that snap to `range.lowerBound + k × step`; `nil` for none.
    public init(
        _ label: LocalizedStringKey,
        value: Binding<Double?>,
        in range: ClosedRange<Double>,
        decimalPlaces: Int = 0,
        step: Double? = nil,
        unit: LocalizedStringKey? = nil,
        caption: LocalizedStringKey? = nil,
        error: FieldError = .none,
        input: Input = .keyboard
    ) {
        self.label = Text(label)
        self.value = value
        rules = NumberEntryRules(range: range, decimalPlaces: decimalPlaces)
        self.step = step
        self.unit = unit.map { Text($0) }
        self.caption = caption.map { Text($0) }
        self.error = error
        self.input = input
    }

    /// An editor over a number that is never empty: clearing the field keeps the last value until a new one is typed.
    public init(
        _ label: LocalizedStringKey,
        value: Binding<Double>,
        in range: ClosedRange<Double>,
        decimalPlaces: Int = 0,
        step: Double? = nil,
        unit: LocalizedStringKey? = nil,
        caption: LocalizedStringKey? = nil,
        error: FieldError = .none,
        input: Input = .keyboard
    ) {
        let optional = Binding<Double?>(
            get: { value.wrappedValue },
            set: { if let new = $0 { value.wrappedValue = new } }
        )
        self.init(
            label,
            value: optional,
            in: range,
            decimalPlaces: decimalPlaces,
            step: step,
            unit: unit,
            caption: caption,
            error: error,
            input: input
        )
    }

    public var body: some View {
        VStack(spacing: Space.md) {
            label
                .font(theme.font(.subheadline).weight(.semibold))
                .foregroundStyle(theme.palette.textSecondary)
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
            HStack(spacing: Space.md) {
                if step != nil { stepButton(.down) }
                hero.shake(trigger: shakes)
                if step != nil { stepButton(.up) }
            }
            .buttonRepeatBehavior(.enabled)
            FieldLine(helper: caption, content: FieldLineContent(hasHelper: caption != nil, error: error))
                .multilineTextAlignment(.center)
            if input == .keypad {
                NumberKeypad(allowsDecimal: rules.decimalPlaces > 0, decimalSeparator: separators.decimal) { key in
                    edit { $0.press(key) }
                }
            }
        }
        .onChange(of: value.wrappedValue) { _, new in update { $0.sync(new) } }
        .onChange(of: isFocused) { _, focused in if !focused { commit() } }
        .onDisappear { if input == .keypad { commit() } }
        .koboFeedback(shakes == 0 ? nil : .error, trigger: shakes)
    }

    @ViewBuilder
    private var hero: some View {
        switch input {
        case .keyboard:
            NumberEntryHero(text: current.text, number: current.number, unit: unit, field: keyboardField)
        case .keypad:
            NumberEntryHero(text: current.text, number: current.number, unit: unit, field: EmptyView())
                .accessibilityElement(children: .ignore)
                .modifier(NumberEntrySpeech(label: label, value: spokenValue, step: step, move: move))
        }
    }

    /// The system pad's field: no ink of its own, only the caret over the drawn digits.
    private var keyboardField: some View {
        TextField(text: textBinding) { label }
            .labelsHidden()
            .font(theme.font(.display))
            .multilineTextAlignment(.center)
            .foregroundStyle(Color.clear)
            .tint(theme.palette.accent)
            .focused($isFocused)
            .numberPad(allowsDecimal: rules.decimalPlaces > 0)
            .keyboardAccessoryBar(onDone: { isFocused = false })
            .modifier(NumberEntrySpeech(label: label, value: spokenValue, step: step, move: move))
    }

    private func stepButton(_ direction: StepperMath.Direction) -> some View {
        let isUp = direction == .up
        let base = current.number ?? rules.range.lowerBound
        return IconButton(
            isUp ? "plus" : "minus",
            label: isUp ? Text("Increase", bundle: .module) : Text("Decrease", bundle: .module),
            style: .tonal,
            size: .large
        ) { move(direction) }
        .disabled(!StepperMath.canStep(base, by: step ?? 0, direction, in: rules.range))
    }
}

extension NumberEntry {
    private var separators: LocalizedNumberText.Separators { LocalizedNumberText.Separators(locale: locale) }

    /// The field state: the edited one, or a fresh one over the caller's value before the first edit.
    private var current: NumberEntryText {
        field ?? NumberEntryText(number: value.wrappedValue, rules: rules, separators: separators)
    }

    private var textBinding: Binding<String> {
        Binding(
            get: { current.text },
            set: { new in
                edit { state in
                    state.text = new
                    return state.normalize()
                }
            }
        )
    }

    private var spokenValue: Text {
        let shown = current.text.isEmpty ? "0" : current.text
        guard let unit else { return Text(verbatim: shown) }
        return Text("\(shown) \(unit)", bundle: .module)
    }

    /// Runs one edit on the field state, then reports the new number and shakes when the edit was cut or refused.
    private func edit(_ body: (inout NumberEntryText) -> NumberEntryText.Change?) {
        var next = current
        let change = body(&next)
        field = next
        guard let change else { return }
        if change.valueChanged { value.wrappedValue = change.number }
        if change.shakes { shakes += 1 }
    }

    private func update(_ body: (inout NumberEntryText) -> Void) {
        var next = current
        body(&next)
        field = next
    }

    private func commit() {
        edit { $0.commit() }
    }

    private func move(_ direction: StepperMath.Direction) {
        guard let step else { return }
        let next = StepperMath.stepped(current.number ?? rules.range.lowerBound, by: step, direction, in: rules.range)
        update { $0.sync(next) }
        value.wrappedValue = next
    }
}
