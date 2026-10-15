import KoboTokens
import SwiftUI

/// The line under a field box. It opens on `Motion.present`, and the helper and the error cross-fade in place; with
/// Reduce Motion the height changes at once.
struct FieldLine: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let helper: Text?
    let content: FieldLineContent

    var body: some View {
        ZStack(alignment: .topLeading) {
            switch content {
            case .none:
                EmptyView()
            case .helper:
                helper?
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, Space.xs)
                    .transition(Motion.fade(reduceMotion: reduceMotion))
            case .error(let message):
                FieldErrorText(message: message)
                    .padding(.top, Space.xs)
                    .transition(Motion.fade(reduceMotion: reduceMotion))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .clipped()
        .koboAnimation(.present, value: content)
    }
}

extension View {
    /// How a field control speaks: the label, then the value with the unit and the error message, then the helper
    /// as the hint. Every modifier is always applied, so a new error never changes identity or drops focus.
    func fieldAccessibility(label: Text?, value: String, unit: Text? = nil, helper: Text?, error: FieldError)
        -> some View
    {
        accessibilityLabel(label ?? Text(verbatim: ""))
            .accessibilityValue(FieldSpeech.value(value, unit: unit, error: error))
            .accessibilityHint(helper ?? Text(verbatim: ""))
    }
}

/// The spoken value of a field: "135 lb, Too heavy".
enum FieldSpeech {
    static func value(_ value: String, unit: Text?, error: FieldError) -> Text {
        let base = unit.map { Text("\(value) \($0)", bundle: .module) } ?? Text(verbatim: value)
        guard let message = error.message else { return base }
        return Text("\(base), \(message)", bundle: .module)
    }
}
