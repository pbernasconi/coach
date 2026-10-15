import KoboTokens
import SwiftUI

// `NumberEntry` initialisers whose label is shown as is: a runtime name such as the item being counted.
extension NumberEntry {
    /// An editor over an optional number, labelled as is.
    public init(
        verbatim label: String,
        value: Binding<Double?>,
        in range: ClosedRange<Double>,
        decimalPlaces: Int = 0,
        step: Double? = nil,
        unit: LocalizedStringKey? = nil,
        caption: LocalizedStringKey? = nil,
        error: FieldError = .none,
        input: Input = .keyboard
    ) {
        self.init(
            "",
            value: value,
            in: range,
            decimalPlaces: decimalPlaces,
            step: step,
            unit: unit,
            caption: caption,
            error: error,
            input: input
        )
        self.label = Text(verbatim: label)
    }

    /// An editor over a number that is never empty, labelled as is.
    public init(
        verbatim label: String,
        value: Binding<Double>,
        in range: ClosedRange<Double>,
        decimalPlaces: Int = 0,
        step: Double? = nil,
        unit: LocalizedStringKey? = nil,
        caption: LocalizedStringKey? = nil,
        error: FieldError = .none,
        input: Input = .keyboard
    ) {
        self.init(
            "",
            value: value,
            in: range,
            decimalPlaces: decimalPlaces,
            step: step,
            unit: unit,
            caption: caption,
            error: error,
            input: input
        )
        self.label = Text(verbatim: label)
    }
}
