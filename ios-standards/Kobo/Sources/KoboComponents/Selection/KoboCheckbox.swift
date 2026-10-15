import KoboTokens
import SwiftUI

/// A checkbox: a box and its label, where the whole label is the target. It takes a `Bool` like a `Toggle`, or a
/// `CheckboxState` for a parent that can be mixed ("All equipment" over its items). VoiceOver reads one element with
/// "Checked", "Not checked" or "Mixed", and a tap plays the toggle haptic. A bare box (no label) needs an
/// accessibility label. For a list row with a subtitle and a leading icon use `CheckRow`; to restyle a `Toggle`, use
/// `.toggleStyle(.koboCheckbox)`.
///
///     KoboCheckbox("Warm-up sets", isOn: $includeWarmUps)
///     KoboCheckbox("All equipment", state: $allEquipment)
///     KoboCheckbox(isOn: $selected, accessibilityLabel: "Select set 2")
public struct KoboCheckbox: View {
    private let title: Text?
    private let accessibilityLabel: Text?
    private let state: Binding<CheckboxState>

    /// A checkbox with a localized label over a `Bool`.
    public init(_ title: LocalizedStringKey, isOn: Binding<Bool>) {
        self.init(title: Text(title), accessibilityLabel: nil, state: Self.state(isOn))
    }

    /// A checkbox whose label is shown as is (an exercise name) over a `Bool`.
    public init(verbatim title: String, isOn: Binding<Bool>) {
        self.init(title: Text(verbatim: title), accessibilityLabel: nil, state: Self.state(isOn))
    }

    /// A checkbox with a localized label over a three-state value. A tap on a mixed box turns it on.
    public init(_ title: LocalizedStringKey, state: Binding<CheckboxState>) {
        self.init(title: Text(title), accessibilityLabel: nil, state: state)
    }

    /// A three-state checkbox whose label is shown as is.
    public init(verbatim title: String, state: Binding<CheckboxState>) {
        self.init(title: Text(verbatim: title), accessibilityLabel: nil, state: state)
    }

    /// A bare box with no visible label, named for VoiceOver (a selection box in a table row).
    public init(isOn: Binding<Bool>, accessibilityLabel: LocalizedStringKey) {
        self.init(title: nil, accessibilityLabel: Text(accessibilityLabel), state: Self.state(isOn))
    }

    private init(title: Text?, accessibilityLabel: Text?, state: Binding<CheckboxState>) {
        self.title = title
        self.accessibilityLabel = accessibilityLabel
        self.state = state
    }

    @ViewBuilder public var body: some View {
        if let title {
            CheckboxControl(state: state.wrappedValue, accessibilityLabel: nil, toggle: toggle) { title }
        } else {
            CheckboxControl(state: state.wrappedValue, accessibilityLabel: accessibilityLabel, toggle: toggle) {
                EmptyView()
            }
        }
    }

    private func toggle() {
        state.wrappedValue = state.wrappedValue.toggled
    }

    /// A `Bool` seen as a two-state checkbox.
    static func state(_ isOn: Binding<Bool>) -> Binding<CheckboxState> {
        Binding(get: { CheckboxState(isOn.wrappedValue) }, set: { isOn.wrappedValue = $0.isOn })
    }
}

#if DEBUG
    private struct KoboCheckboxGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var warmUps = true
        @State private var plates = [
            Plate(kilograms: 5, isOn: true), Plate(kilograms: 10), Plate(kilograms: 20, isOn: true),
        ]
        @State private var selected = false

        var body: some View {
            VStack(alignment: .leading, spacing: Space.xs) {
                KoboCheckbox("Include warm-up sets", isOn: $warmUps)
                KoboCheckbox("All plates", state: allPlates)
                ForEach($plates) { $plate in
                    KoboCheckbox(verbatim: "\(plate.kilograms) kg plates", isOn: $plate.isOn)
                        .padding(.leading, Space.xxxl)
                }
                KoboCheckbox("Track bar weight in the total, so every set shows the real load", isOn: .constant(true))
                KoboCheckbox("Locked by your coach", isOn: .constant(false)).disabled(true)
                KoboCheckbox(isOn: $selected, accessibilityLabel: "Select set 2")
            }
            .padding(Space.gutter)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(theme.palette.canvas)
        }

        private var allPlates: Binding<CheckboxState> {
            Binding(
                get: { CheckboxState(children: plates.map(\.isOn)) },
                set: { state in
                    for index in plates.indices { plates[index].isOn = state.isOn }
                }
            )
        }
    }

    private struct Plate: Identifiable {
        let kilograms: Int
        var isOn = false
        var id: Int { kilograms }
    }

    #Preview("Checkbox") { KoboCheckboxGallery() }
    #Preview("Checkbox · dark, Amber") { KoboCheckboxGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Checkbox · AX3") { KoboCheckboxGallery().dynamicTypeSize(.accessibility3) }
#endif
