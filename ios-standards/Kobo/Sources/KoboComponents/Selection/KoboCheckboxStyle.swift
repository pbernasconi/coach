import KoboTokens
import SwiftUI

/// A `Toggle` drawn as a Kobo checkbox: the box beside the label, the whole label as the target. A toggle over several
/// sources (`Toggle(sources:isOn:)`) shows the mixed dash when only some are on, and a tap on it turns them all on.
///
///     Toggle("Warm-up sets", isOn: $warmUps).toggleStyle(.koboCheckbox)
///     Toggle("All equipment", sources: $equipment, isOn: \.isOwned).toggleStyle(.koboCheckbox)
public struct KoboCheckboxStyle: ToggleStyle {
    public init() {}

    public func makeBody(configuration: Configuration) -> some View {
        let state: CheckboxState = configuration.isMixed ? .mixed : CheckboxState(configuration.isOn)
        return CheckboxControl(state: state, accessibilityLabel: nil) {
            configuration.isOn = state.toggled.isOn
        } label: {
            configuration.label
        }
    }
}

extension ToggleStyle where Self == KoboCheckboxStyle {
    /// The Kobo checkbox. See `KoboCheckboxStyle`.
    public static var koboCheckbox: KoboCheckboxStyle { KoboCheckboxStyle() }
}
