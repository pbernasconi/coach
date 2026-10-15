import KoboComponents
import KoboTokens
import LiftCore
import SwiftUI

/// Sizes of the Plates and bars page.
enum PlatesMetrics {
    /// The largest text size of the kg | lb picker: past it the segments would stack; here they still read side by side.
    static let pickerTypeSize = DynamicTypeSize.xxxLarge
}

/// Dumb view: the kg | lb picker, then that unit's bar, plates and collars as flat lists, and "Reset to defaults"
/// (SCR-2). A plate opens a sheet with its switch and pair count.
struct PlatesContent: View {
    let state: PlatesState
    let send: (PlatesAction) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.section) {
                SegmentedPicker(
                    "Unit",
                    selection: .action(state.unit) { send(.unitShown($0)) },
                    options: [
                        ChoiceOption(WeightUnit.kg, title: "Kilograms (kg)"),
                        ChoiceOption(WeightUnit.lb, title: "Pounds (lb)"),
                    ]
                )
                .dynamicTypeSize(...PlatesMetrics.pickerTypeSize)
                if let kit = state.kit {
                    PlatesBarSection(kit: kit, send: send)
                    PlatesPlateSection(kit: kit, send: send)
                    PlatesCollarSection(kit: kit, send: send)
                    ListSection(footer: "Plates per side, warm-ups and weight steps on the Workout screen use these.") {
                        ListRow("Reset to defaults", action: { send(.resetTapped) }) {
                            EmptyView()
                        } trailing: {
                            Image(systemName: "arrow.counterclockwise")
                                .accessibilityHidden(true)
                        }
                        .disabled(!state.canReset)
                    }
                }
            }
            .pageColumn()
            .padding(.top, Space.sm)
            .padding(.bottom, Space.xxl)
        }
        .screenCanvas()
        .navigationTitle(Text("Plates and bars"))
        .navigationBarTitleDisplayMode(.inline)
        .koboSheet(
            item: Binding<PlateEditor?>.action(state.plateEditor) { if $0 == nil { send(.plateEditorDismissed) } },
            title: PlatesText.plateTitle
        ) { editor in
            PlateEditorFields(plate: editor.plate, send: send)
        }
    }
}

/// The bar loads start from: one choice of the unit's bar weights.
private struct PlatesBarSection: View {
    let kit: BarbellSetup
    let send: (PlatesAction) -> Void

    var body: some View {
        ListSection("Bar") {
            ForEach(BarbellSetup.bars(kit.unit).map(WeightChoice.init)) { choice in
                RadioRow(
                    verbatim: PlatesText.weight(choice.value, kit.unit),
                    isSelected: choice.value == kit.bar,
                    action: { send(.barSelected(choice.value)) }
                )
            }
        }
    }
}

/// Every plate size for the unit, heaviest first, with its pairs or "Off".
private struct PlatesPlateSection: View {
    let kit: BarbellSetup
    let send: (PlatesAction) -> Void

    var body: some View {
        ListSection("Plates", footer: "Plates that are off are never used. Pairs: how many of each the gym has.") {
            ForEach(kit.plates) { plate in
                ListRow(
                    verbatim: PlatesText.weight(plate.size, kit.unit),
                    value: PlatesText.plate(plate),
                    action: { send(.plateTapped(plate.size)) }
                )
            }
        }
    }
}

/// Collars: none, or competition collars, which count in every load.
private struct PlatesCollarSection: View {
    let kit: BarbellSetup
    let send: (PlatesAction) -> Void

    var body: some View {
        ListSection("Collars", footer: "Collars count in every load, the empty bar too.") {
            ForEach(BarbellSetup.collars(kit.unit).map(WeightChoice.init)) { choice in
                RadioRow(
                    verbatim: PlatesText.collar(choice.value, kit.unit),
                    isSelected: choice.value == kit.collar,
                    action: { send(.collarSelected(choice.value)) }
                )
            }
        }
    }
}

/// The plate sheet: whether the gym has the plate and, when it does, how many pairs.
struct PlateEditorFields: View {
    let plate: GymPlate
    let send: (PlatesAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.lg) {
            ToggleRow("In this gym", isOn: .action(plate.isAvailable) { send(.plateAvailabilityToggled($0)) })
            if plate.isAvailable {
                StepperField(
                    "Pairs",
                    value: .action(plate.pairs) { send(.platePairsChanged($0)) },
                    in: GymPlate.pairRange
                )
            }
        }
    }
}

/// A weight to choose from, identified by its value (for `ForEach`).
private nonisolated struct WeightChoice: Identifiable {
    let value: Double

    var id: Double { value }
}
