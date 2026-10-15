import KoboTokens
import SwiftUI

/// How a `NumberEntry` speaks: its label, the value with its unit, and swipe up or down to step when it has a step.
struct NumberEntrySpeech: ViewModifier {
    let label: Text
    let value: Text
    let step: Double?
    let move: (StepperMath.Direction) -> Void

    func body(content: Content) -> some View {
        if step != nil {
            content
                .accessibilityLabel(label)
                .accessibilityValue(value)
                .accessibilityAdjustableAction { direction in
                    switch direction {
                    case .increment: move(.up)
                    case .decrement: move(.down)
                    @unknown default: break
                    }
                }
        } else {
            content
                .accessibilityLabel(label)
                .accessibilityValue(value)
        }
    }
}

extension View {
    /// The system number pad, or the decimal pad when the field takes decimals. Off iOS it does nothing.
    @ViewBuilder
    func numberPad(allowsDecimal: Bool) -> some View {
        #if os(iOS)
            keyboardType(allowsDecimal ? .decimalPad : .numberPad)
        #else
            self
        #endif
    }
}

#if DEBUG
    private struct NumberEntryGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var weight = 102.5
        @State private var reps: Double?
        @State private var bodyWeight: Double? = 182.4

        var body: some View {
            ScrollView {
                VStack(spacing: Space.xxl) {
                    NumberEntry(
                        "Weight",
                        value: $weight,
                        in: 0...1000,
                        decimalPlaces: 1,
                        step: 2.5,
                        unit: "lb",
                        caption: "Last time 100 lb × 8",
                        input: .keypad
                    )
                    NumberEntry("Reps", value: $reps, in: 1...50, step: 1)
                    NumberEntry(
                        "Body weight",
                        value: $bodyWeight,
                        in: 50...400,
                        decimalPlaces: 1,
                        unit: "lb",
                        error: .message("Enter a weight between 50 and 400 lb")
                    )
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Number entry") { NumberEntryGallery() }
    #Preview("Number entry · dark, Lift") { NumberEntryGallery().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Number entry · AX3") { NumberEntryGallery().dynamicTypeSize(.accessibility3) }
    #Preview("Number entry · German") { NumberEntryGallery().environment(\.locale, Locale(identifier: "de_DE")) }
#endif
