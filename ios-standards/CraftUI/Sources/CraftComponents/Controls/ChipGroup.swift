import CraftTokens
import SwiftUI

/// A wrapping group of chips with single or multiple selection. Each chip carries the selected trait; the group is
/// one accessibility container named by `title`.
///
///     ChipGroup("Equipment", options: equipment, selection: $filters, mode: .multiple)
///     ChipGroup("Split", options: splits, selection: $split)
public struct ChipGroup<Value: Hashable & Sendable>: View {
    private let title: LocalizedStringKey
    private let options: [ChoiceOption<Value>]
    private let selection: Binding<Set<Value>>
    private let mode: SelectionMode
    private let tone: Tone
    private let feedback: HapticFeedback?

    /// A group over a set of selected values. `title` names the group for VoiceOver.
    public init(
        _ title: LocalizedStringKey,
        options: [ChoiceOption<Value>],
        selection: Binding<Set<Value>>,
        mode: SelectionMode = .multiple,
        tone: Tone = .accent,
        feedback: HapticFeedback? = .selection
    ) {
        self.title = title
        self.options = options
        self.selection = selection
        self.mode = mode
        self.tone = tone
        self.feedback = feedback
    }

    /// A single-select group over one value: always exactly one chip on.
    public init(
        _ title: LocalizedStringKey,
        options: [ChoiceOption<Value>],
        selection: Binding<Value>,
        tone: Tone = .accent,
        feedback: HapticFeedback? = .selection
    ) {
        let values = Binding<Set<Value>>(
            get: { [selection.wrappedValue] },
            set: { newValue in
                if let first = newValue.first { selection.wrappedValue = first }
            }
        )
        self.init(title, options: options, selection: values, mode: .single, tone: tone, feedback: feedback)
    }

    public var body: some View {
        FlowLayout(spacing: Space.sm, lineSpacing: 0) {
            ForEach(options) { option in
                Chip(
                    title: option.title,
                    systemImage: option.systemImage,
                    tone: tone,
                    isSelected: selection.wrappedValue.contains(option.value)
                ) {
                    selection.wrappedValue = ChipSelection.toggled(option.value, in: selection.wrappedValue, mode: mode)
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Text(title))
        .craftFeedback(feedback, trigger: selection.wrappedValue)
    }
}

#if DEBUG
    private struct ChipGroupGallery: View {
        @Environment(\.craftTheme) private var theme
        @State private var equipment: Set<String> = ["barbell", "cable"]
        @State private var split = "upper"

        private let equipmentOptions = [
            ChoiceOption("barbell", title: "Barbell", systemImage: "dumbbell"),
            ChoiceOption("dumbbell", title: "Dumbbells"),
            ChoiceOption("cable", title: "Cable"),
            ChoiceOption("machine", title: "Machine"),
            ChoiceOption("bodyweight", title: "Bodyweight", systemImage: "figure.strengthtraining.functional"),
        ]
        private let splitOptions = [
            ChoiceOption("upper", title: "Upper"),
            ChoiceOption("lower", title: "Lower"),
            ChoiceOption("full", title: "Full body"),
        ]

        var body: some View {
            VStack(alignment: .leading, spacing: Space.lg) {
                ChipGroup("Equipment", options: equipmentOptions, selection: $equipment)
                ChipGroup("Split", options: splitOptions, selection: $split)
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Chip group") { ChipGroupGallery() }
    #Preview("Chip group · dark") { ChipGroupGallery().preferredColorScheme(.dark) }
    #Preview("Chip group · AX3") { ChipGroupGallery().dynamicTypeSize(.accessibility3) }
#endif
