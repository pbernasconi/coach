import Foundation
import KoboTokens
import SwiftUI

/// A number whose digits roll to each new value (`.numericText`), with tabular digits so the width holds still.
/// The roll uses `Motion.defaultEffects`; with Reduce Motion on the value swaps at once. Style it with `.font`.
///
///     AnimatedNumber(volume, format: .number.precision(.fractionLength(1)))
public struct AnimatedNumber<Format: FormatStyle>: View
where Format.FormatInput == Double, Format.FormatOutput == String {
    private let value: Double
    private let format: Format

    public init(_ value: Double, format: Format) {
        self.value = value
        self.format = format
    }

    public var body: some View {
        Text(value, format: format)
            .monospacedDigit()
            .contentTransition(.numericText(value: value))
            .koboAnimation(.defaultEffects, value: value)
    }
}

extension AnimatedNumber where Format == FloatingPointFormatStyle<Double> {
    /// A decimal number in the current locale.
    public init(_ value: Double) {
        self.init(value, format: .number)
    }

    /// A whole number in the current locale.
    public init(_ value: Int) {
        self.init(Double(value), format: .number.precision(.fractionLength(0)))
    }
}

private struct AnimatedNumberPreview: View {
    @State private var value = 1250
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(spacing: Space.lg) {
            AnimatedNumber(value).font(theme.font(.display))
            AnimatedNumber(Double(value) / 1000, format: .number.precision(.fractionLength(1)))
                .font(theme.font(.title2))
            Button("Add a set") { value += 135 }
        }
        .padding()
    }
}

#if DEBUG
    #Preview("Animated number") { AnimatedNumberPreview() }
    #Preview("Animated number, dark") { AnimatedNumberPreview().preferredColorScheme(.dark) }
    #Preview("Animated number, AX3") { AnimatedNumberPreview().dynamicTypeSize(.accessibility3) }
#endif
