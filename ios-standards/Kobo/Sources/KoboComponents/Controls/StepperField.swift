import KoboTokens
import SwiftUI

/// A big, centred number with large − and + buttons: distances, counts, minutes. Steps snap to `step` within `range`
/// (2.5 steps from 21 go to 22.5); holding a button repeats. VoiceOver reads one adjustable element (swipe up or
/// down to step). Pair it with a `QuickPickRow` for one-tap nearby values.
///
///     StepperField("Distance", value: $distance, in: 0...500, step: 2.5, unit: "km")
///     StepperField("Guests", value: $guests, in: 1...50)
///     StepperField(verbatim: recipe.name, value: $amount, in: 0...500, unit: settings.unitSymbol)
public struct StepperField: View {
    @Environment(\.koboTheme) private var theme
    private let title: Text
    private let value: Binding<Double>
    private let range: ClosedRange<Double>
    private let step: Double
    private let unit: Text?
    private let playsHaptics: Bool
    private let format: (Double) -> String

    /// A field over a `Double`, formatted by `format` (up to two decimals by default).
    public init(
        _ title: LocalizedStringKey,
        value: Binding<Double>,
        in range: ClosedRange<Double>,
        step: Double = 1,
        unit: LocalizedStringKey? = nil,
        playsHaptics: Bool = true,
        format: @escaping (Double) -> String = { $0.formatted(.number.precision(.fractionLength(0...2))) }
    ) {
        self.init(
            title: Text(title),
            value: value,
            in: range,
            step: step,
            unit: unit.map { Text($0) },
            playsHaptics: playsHaptics,
            format: format
        )
    }

    /// The one place every initialiser lands: ready-made texts and a formatter.
    init(
        title: Text,
        value: Binding<Double>,
        in range: ClosedRange<Double>,
        step: Double,
        unit: Text?,
        playsHaptics: Bool,
        format: @escaping (Double) -> String
    ) {
        self.title = title
        self.value = value
        self.range = range
        self.step = step
        self.unit = unit
        self.playsHaptics = playsHaptics
        self.format = format
    }

    /// A field over a `Double`, formatted by a `FormatStyle` such as `.number.precision(.fractionLength(1))`.
    public init<Style: FormatStyle>(
        _ title: LocalizedStringKey,
        value: Binding<Double>,
        in range: ClosedRange<Double>,
        step: Double = 1,
        unit: LocalizedStringKey? = nil,
        playsHaptics: Bool = true,
        format style: Style
    ) where Style.FormatInput == Double, Style.FormatOutput == String {
        self.init(
            title,
            value: value,
            in: range,
            step: step,
            unit: unit,
            playsHaptics: playsHaptics,
            format: { style.format($0) }
        )
    }

    /// A field over an `Int` (guests, minutes).
    public init(
        _ title: LocalizedStringKey,
        value: Binding<Int>,
        in range: ClosedRange<Int>,
        step: Int = 1,
        unit: LocalizedStringKey? = nil,
        playsHaptics: Bool = true
    ) {
        let double = Binding<Double>(
            get: { Double(value.wrappedValue) },
            set: { value.wrappedValue = Int($0.rounded()) }
        )
        self.init(
            title,
            value: double,
            in: Double(range.lowerBound)...Double(range.upperBound),
            step: Double(step),
            unit: unit,
            playsHaptics: playsHaptics,
            format: { Int($0.rounded()).formatted() }
        )
    }

    /// `count` grid values around `value` for a `QuickPickRow`, shifted to stay inside `range`.
    ///
    ///     StepperField.nearbyValues(around: 100, step: 5, in: 0...500)  // [90, 95, 100, 105, 110]
    public static func nearbyValues(around value: Double, step: Double, count: Int = 5, in range: ClosedRange<Double>)
        -> [Double]
    {
        StepperMath.nearby(value, step: step, count: count, in: range)
    }

    public var body: some View {
        let current = StepperMath.clamped(value.wrappedValue, to: range)
        HStack(spacing: Space.md) {
            IconButton("minus", label: Text("Decrease", bundle: .module), style: .tonal, size: .large) { move(.down) }
                .disabled(!StepperMath.canStep(current, by: step, .down, in: range))
            VStack(spacing: Space.xxs) {
                Text(verbatim: format(current))
                    .font(theme.font(.display))
                    .foregroundStyle(theme.palette.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(Self.minimumScale)
                    .contentTransition(.numericText(value: current))
                    .koboAnimation(.defaultEffects, value: current)
                if let unit {
                    unit.font(theme.font(.footnote)).foregroundStyle(theme.palette.textSecondary)
                }
            }
            .frame(maxWidth: .infinity)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(title)
            .accessibilityValue(spokenValue(current))
            .accessibilityAdjustableAction { direction in
                switch direction {
                case .increment: move(.up)
                case .decrement: move(.down)
                @unknown default: break
                }
            }
            IconButton("plus", label: Text("Increase", bundle: .module), style: .tonal, size: .large) { move(.up) }
                .disabled(!StepperMath.canStep(current, by: step, .up, in: range))
        }
        .buttonRepeatBehavior(.enabled)
        .koboFeedback(trigger: value.wrappedValue) { old, new in
            guard playsHaptics else { return nil }
            return new > old ? .increase : .decrease
        }
    }

    /// How far a long number may shrink before it truncates.
    private static let minimumScale: CGFloat = 0.5

    private func move(_ direction: StepperMath.Direction) {
        value.wrappedValue = StepperMath.stepped(value.wrappedValue, by: step, direction, in: range)
    }

    private func spokenValue(_ current: Double) -> Text {
        guard let unit else { return Text(verbatim: format(current)) }
        return Text("\(format(current)) \(unit)")
    }
}

#if DEBUG
    private struct StepperFieldGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var distance = 102.5
        @State private var guests = 8

        var body: some View {
            VStack(spacing: Space.xl) {
                StepperField("Distance", value: $distance, in: 0...500, step: 2.5, unit: "km")
                QuickPickRow(
                    "Quick distances",
                    values: StepperField.nearbyValues(around: distance, step: 2.5, in: 0...500),
                    selection: $distance,
                    format: .number.precision(.fractionLength(0...1))
                )
                StepperField("Guests", value: $guests, in: 1...50, unit: "people")
                StepperField("At limit", value: .constant(0.0), in: 0...10, step: 0.5)
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Stepper field") { StepperFieldGallery() }
    #Preview("Stepper field · dark, Amber") { StepperFieldGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Stepper field · AX3") { StepperFieldGallery().dynamicTypeSize(.accessibility3) }
#endif
