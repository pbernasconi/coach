import KoboComponents
import KoboPatterns
import KoboTokens
import SwiftUI

/// Live demos for the Controls section. Sample data only; nothing here ships in an app.
struct ControlsDemo: View {
    let component: CatalogComponent
    @State private var minutes = 45.0
    @State private var servings = 4
    @State private var tags: Set<String> = ["Work"]
    @State private var unit = "km"
    @State private var isOn = true
    @State private var shakes = 0

    private let clock = ContinuousClock()
    private let places = ["Lisbon", "Kyoto", "Oaxaca", "Reykjavík", "Tallinn"].map {
        ChoiceOption($0, verbatim: $0)
    }
    private let tagOptions = ["Work", "Home", "Errands", "Ideas"].map {
        ChoiceOption($0, verbatim: $0)
    }
    private let unitOptions = ["km", "mi"].map { ChoiceOption($0, verbatim: $0) }

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
                Chip(verbatim: "Selected", isSelected: true) {}
                Chip(verbatim: "Not selected", isSelected: false) {}
            }
        case .chipGroup: ChipGroup("Tags", options: tagOptions, selection: $tags)
        case .filterBar:
            FilterBar(activeCount: tags.isEmpty ? 0 : 1, onFilters: {}) {
                FilterChip("Tags", selection: tags.sorted(), onClear: { tags = [] }) { tags = ["Work"] }
                FilterChip("Place", selection: [], onClear: {}) {}
            }
        case .filterChip:
            FilterChip("Tags", selection: tags.sorted(), onClear: { tags = [] }) {
                tags = ["Work", "Home"]
            }
        case .tag:
            HStack {
                KoboTag(verbatim: "New", tone: .success, systemImage: "sparkles")
                KoboTag(verbatim: "2 h")
            }
        case .segmentedPicker: SegmentedPicker("Unit", selection: $unit, options: unitOptions)
        case .toggleRow:
            ToggleRow(
                "Focus mode",
                subtitle: "Silence alerts while a timer runs",
                systemImage: "moon",
                isOn: $isOn
            )
        case .stepperField: StepperField("Duration", value: $minutes, in: 0...240, step: 5, unit: "min")
        case .quickPickRow:
            QuickPickRow("Servings", values: [1, 2, 4, 6, 8], selection: $servings) { "\($0)" }
        case .flowLayout:
            FlowLayout {
                ForEach(places) { KoboTag(verbatim: $0.value) }
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
