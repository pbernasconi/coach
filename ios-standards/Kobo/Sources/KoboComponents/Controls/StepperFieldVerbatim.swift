import KoboTokens
import SwiftUI

// `StepperField` initialisers whose title and unit are shown as is (an exercise name, a unit the user picked).
extension StepperField {
    /// A field over a `Double` with a title and unit shown as is, formatted by `format`.
    public init(
        verbatim title: String,
        value: Binding<Double>,
        in range: ClosedRange<Double>,
        step: Double = 1,
        unit: String? = nil,
        playsHaptics: Bool = true,
        format: @escaping (Double) -> String = { $0.formatted(.number.precision(.fractionLength(0...2))) }
    ) {
        self.init(
            title: Text(verbatim: title),
            value: value,
            in: range,
            step: step,
            unit: unit.map { Text(verbatim: $0) },
            playsHaptics: playsHaptics,
            format: format
        )
    }

    /// A field over a `Double` with a title and unit shown as is, formatted by a `FormatStyle`.
    public init<Style: FormatStyle>(
        verbatim title: String,
        value: Binding<Double>,
        in range: ClosedRange<Double>,
        step: Double = 1,
        unit: String? = nil,
        playsHaptics: Bool = true,
        format style: Style
    ) where Style.FormatInput == Double, Style.FormatOutput == String {
        self.init(
            verbatim: title,
            value: value,
            in: range,
            step: step,
            unit: unit,
            playsHaptics: playsHaptics,
            format: { style.format($0) }
        )
    }

    /// A field over an `Int` with a title and unit shown as is.
    public init(
        verbatim title: String,
        value: Binding<Int>,
        in range: ClosedRange<Int>,
        step: Int = 1,
        unit: String? = nil,
        playsHaptics: Bool = true
    ) {
        let double = Binding<Double>(
            get: { Double(value.wrappedValue) },
            set: { value.wrappedValue = Int($0.rounded()) }
        )
        self.init(
            verbatim: title,
            value: double,
            in: Double(range.lowerBound)...Double(range.upperBound),
            step: Double(step),
            unit: unit,
            playsHaptics: playsHaptics,
            format: { Int($0.rounded()).formatted() }
        )
    }
}
