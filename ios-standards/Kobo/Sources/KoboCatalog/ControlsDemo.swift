import KoboComponents
import KoboTokens
import SwiftUI

/// Live demos for the Controls section. Sample data only; nothing here ships in an app.
struct ControlsDemo: View {
    let component: CatalogComponent
    @State private var weight = 135.0
    @State private var reps = 8
    @State private var muscles: Set<String> = ["Legs"]
    @State private var unit = "lb"
    @State private var isOn = true
    @State private var shakes = 0

    private let clock = ContinuousClock()
    private let exercises = ["Squat", "Romanian deadlift", "Leg press", "Calf raise", "Lunge"].map {
        ChoiceOption($0, verbatim: $0)
    }
    private let muscleOptions = ["Legs", "Back", "Chest", "Arms"].map { ChoiceOption($0, verbatim: $0) }
    private let unitOptions = ["lb", "kg"].map { ChoiceOption($0, verbatim: $0) }

    var body: some View {
        switch component {
        case .buttonStyle: buttons
        case .asyncButton:
            AsyncButton("Save") { try await clock.sleep(for: .seconds(1)) }
        case .iconButton:
            HStack(spacing: Space.md) {
                IconButton("plus", accessibilityLabel: "Add", style: .glass) {}
                IconButton("ellipsis", accessibilityLabel: "More", style: .tonal) {}
                IconButton("trash", accessibilityLabel: "Delete", style: .solid) {}
            }
        case .closeButton: CloseButton {}
        case .chip:
            HStack {
                Chip(verbatim: "Selected", isSelected: true) {}; Chip(verbatim: "Not selected", isSelected: false) {}
            }
        case .chipGroup: ChipGroup("Muscles", options: muscleOptions, selection: $muscles)
        case .tag:
            HStack {
                KoboTag(verbatim: "PR", tone: .success, systemImage: "trophy"); KoboTag(verbatim: "3 × 8")
            }
        case .segmentedPicker: SegmentedPicker("Unit", selection: $unit, options: unitOptions)
        case .toggleRow:
            ToggleRow("Hands-free", subtitle: "Log sets after the rest timer", systemImage: "hand.raised", isOn: $isOn)
        case .stepperField: StepperField("Weight", value: $weight, in: 0...600, step: 5, unit: "lb")
        case .quickPickRow: QuickPickRow("Reps", values: [5, 6, 8, 10, 12], selection: $reps) { "\($0)" }
        case .flowLayout:
            FlowLayout {
                ForEach(exercises) { KoboTag(verbatim: $0.value) }
            }
        case .pressFeedback:
            Button("Press and hold") {}.buttonStyle(.pressFeedback(.scaleAndHighlight))
        case .shake:
            Button("Shake") { shakes += 1 }.buttonStyle(.kobo(.secondary)).shake(trigger: shakes)
        default: EmptyView()
        }
    }

    private var buttons: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            Button("Primary") {}.buttonStyle(.kobo(.primary, width: .full))
            Button("Secondary") {}.buttonStyle(.kobo(.secondary))
            Button("Tonal") {}.buttonStyle(.kobo(.tonal))
            Button("Glass") {}.buttonStyle(.kobo(.glass))
            Button("Delete", role: .destructive) {}.buttonStyle(.kobo(.destructive))
            Button("Loading") {}.buttonStyle(.kobo(.primary, isLoading: true))
        }
    }
}
