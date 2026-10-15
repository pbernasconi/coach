import KoboTokens
import SwiftUI

/// The copy of a field, resolved to `Text` once: localized keys for literal copy, verbatim strings for runtime values.
struct FieldCopy {
    let label: Text
    let prompt: Text?
    let helper: Text?
    let unit: Text?

    init(
        label: LocalizedStringKey,
        prompt: LocalizedStringKey? = nil,
        helper: LocalizedStringKey? = nil,
        unit: LocalizedStringKey? = nil
    ) {
        self.label = Text(label)
        self.prompt = prompt.map { Text($0) }
        self.helper = helper.map { Text($0) }
        self.unit = unit.map { Text($0) }
    }

    init(verbatim label: String, prompt: String? = nil, helper: String? = nil, unit: String? = nil) {
        self.label = Text(verbatim: label)
        self.prompt = prompt.map { Text(verbatim: $0) }
        self.helper = helper.map { Text(verbatim: $0) }
        self.unit = unit.map { Text(verbatim: $0) }
    }
}

extension View {
    /// Tabular digits when `isOn`, else the font as is.
    func fieldDigits(_ isOn: Bool) -> some View {
        modifier(FieldDigitsModifier(isOn: isOn))
    }
}

private struct FieldDigitsModifier: ViewModifier {
    let isOn: Bool

    func body(content: Content) -> some View {
        if isOn {
            content.monospacedDigit()
        } else {
            content
        }
    }
}
