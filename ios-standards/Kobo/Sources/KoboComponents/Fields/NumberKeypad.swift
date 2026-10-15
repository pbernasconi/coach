import KoboTokens
import SwiftUI

/// The on-screen keypad of a `NumberEntry` in `.keypad` input: 1–9, the region's decimal separator, 0 and delete, in
/// the phone layout. Keys are large raised buttons; holding delete repeats.
struct NumberKeypad: View {
    @Environment(\.koboTheme) private var theme
    let allowsDecimal: Bool
    let decimalSeparator: Character
    let press: (NumberEntryKey) -> Void

    var body: some View {
        Grid(horizontalSpacing: Space.sm, verticalSpacing: Space.sm) {
            ForEach(Array(NumberEntryKey.rows(allowsDecimal: allowsDecimal).enumerated()), id: \.offset) { _, row in
                GridRow {
                    ForEach(row) { key in
                        keyButton(key)
                            .gridCellColumns(row.count == 2 && key == .digit(0) ? 2 : 1)
                    }
                }
            }
        }
        .buttonRepeatBehavior(.enabled)
    }

    private func keyButton(_ key: NumberEntryKey) -> some View {
        Button {
            press(key)
        } label: {
            keyFace(key)
                .font(theme.font(.title2))
                .foregroundStyle(theme.palette.textPrimary)
                .frame(maxWidth: .infinity, minHeight: Size.buttonHeight)
                .contentShape(Rectangle())
        }
        .buttonStyle(NumberKeyStyle())
        .accessibilityLabel(accessibilityLabel(key))
    }

    @ViewBuilder
    private func keyFace(_ key: NumberEntryKey) -> some View {
        switch key {
        case .digit(let digit): Text(verbatim: String(digit)).monospacedDigit()
        case .decimal: Text(verbatim: String(decimalSeparator))
        case .delete: Image(systemName: "delete.left")
        }
    }

    private func accessibilityLabel(_ key: NumberEntryKey) -> Text {
        switch key {
        case .digit(let digit): Text(verbatim: String(digit))
        case .decimal: Text("Decimal point", bundle: .module)
        case .delete: Text("Delete", bundle: .module)
        }
    }
}

/// A raised key that darkens while pressed (on `Motion.instant`).
private struct NumberKeyStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        NumberKeyFace(label: configuration.label, isPressed: configuration.isPressed)
    }
}

private struct NumberKeyFace<Label: View>: View {
    @Environment(\.koboTheme) private var theme
    let label: Label
    let isPressed: Bool

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
        label
            .background {
                ZStack {
                    shape.fill(theme.palette.surfaceRaised)
                    shape.fill(theme.palette.pressVeil(isPressed))
                }
            }
            .koboAnimation(.instant, value: isPressed)
    }
}
