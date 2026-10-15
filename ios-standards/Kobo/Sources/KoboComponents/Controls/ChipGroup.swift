import KoboTokens
import SwiftUI

/// A wrapping group of chips with single or multiple selection. Each chip carries the selected trait; the group is
/// one accessibility container named by `title`.
///
///     ChipGroup("Diet", options: diets, selection: $filters, mode: .multiple)
///     ChipGroup("Meal", options: meals, selection: $meal)
///     ChipGroup(verbatim: category.name, options: tags, selection: $tags)
public struct ChipGroup<Value: Hashable & Sendable>: View {
    private let title: Text
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
        self.init(
            title: Text(title),
            options: options,
            selection: selection,
            mode: mode,
            tone: tone,
            feedback: feedback
        )
    }

    /// A group over a set of selected values, named as is (a category from user data).
    public init(
        verbatim title: String,
        options: [ChoiceOption<Value>],
        selection: Binding<Set<Value>>,
        mode: SelectionMode = .multiple,
        tone: Tone = .accent,
        feedback: HapticFeedback? = .selection
    ) {
        self.init(
            title: Text(verbatim: title),
            options: options,
            selection: selection,
            mode: mode,
            tone: tone,
            feedback: feedback
        )
    }

    /// A single-select group over one value, named as is.
    public init(
        verbatim title: String,
        options: [ChoiceOption<Value>],
        selection: Binding<Value>,
        tone: Tone = .accent,
        feedback: HapticFeedback? = .selection
    ) {
        let values = Self.single(selection)
        self.init(
            title: Text(verbatim: title),
            options: options,
            selection: values,
            mode: .single,
            tone: tone,
            feedback: feedback
        )
    }

    private init(
        title: Text,
        options: [ChoiceOption<Value>],
        selection: Binding<Set<Value>>,
        mode: SelectionMode,
        tone: Tone,
        feedback: HapticFeedback?
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
        let values = Self.single(selection)
        self.init(
            title: Text(title),
            options: options,
            selection: values,
            mode: .single,
            tone: tone,
            feedback: feedback
        )
    }

    /// A one-value binding seen as a set of exactly one.
    private static func single(_ selection: Binding<Value>) -> Binding<Set<Value>> {
        Binding<Set<Value>>(
            get: { [selection.wrappedValue] },
            set: { newValue in
                if let first = newValue.first { selection.wrappedValue = first }
            }
        )
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
        .accessibilityLabel(title)
        .koboFeedback(feedback, trigger: selection.wrappedValue)
    }
}

#if DEBUG
    private struct ChipGroupGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var diets: Set<String> = ["vegetarian", "quick"]
        @State private var meal = "lunch"

        private let dietOptions = [
            ChoiceOption("vegetarian", title: "Vegetarian", systemImage: "leaf"),
            ChoiceOption("vegan", title: "Vegan"),
            ChoiceOption("quick", title: "Under 30 min"),
            ChoiceOption("budget", title: "Budget"),
            ChoiceOption("nooven", title: "No oven", systemImage: "flame"),
        ]
        private let mealOptions = [
            ChoiceOption("breakfast", title: "Breakfast"),
            ChoiceOption("lunch", title: "Lunch"),
            ChoiceOption("dinner", title: "Dinner"),
        ]

        var body: some View {
            VStack(alignment: .leading, spacing: Space.lg) {
                ChipGroup("Diet", options: dietOptions, selection: $diets)
                ChipGroup("Meal", options: mealOptions, selection: $meal)
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Chip group") { ChipGroupGallery() }
    #Preview("Chip group · dark") { ChipGroupGallery().preferredColorScheme(.dark) }
    #Preview("Chip group · AX3") { ChipGroupGallery().dynamicTypeSize(.accessibility3) }
#endif
