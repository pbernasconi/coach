import KoboTokens
import SwiftUI

/// A stack of `ChoiceCard`s over one binding: exactly one card on (radio discs) for a `Value`, any number (checkboxes)
/// for a `Set<Value>`. Each option's title, subtitle (as the description) and symbol fill its card; an `illustration`
/// closure can draw art per option instead. Options that are not enabled dim and take no taps. A tap that changes the
/// choice plays `feedback`. The group is one accessibility container named by `title`.
///
///     ChoiceCardGroup("Goal", options: goals, selection: $goal)
///     ChoiceCardGroup("Work days", options: days, selection: $days)   // Set: several cards
///     ChoiceCardGroup(verbatim: plan.name, options: templates, selection: $template) { option in TemplateArt(option.value) }
public struct ChoiceCardGroup<Value: Hashable & Sendable, Illustration: View>: View {
    private let title: Text
    private let options: [SelectOption<Value>]
    private let selection: Binding<Set<Value>>
    private let mode: SelectionMode
    private let feedback: HapticFeedback?
    private let illustration: (SelectOption<Value>) -> Illustration

    /// One choice, always set, with a localized group name and an illustration per option.
    public init(
        _ title: LocalizedStringKey,
        options: [SelectOption<Value>],
        selection: Binding<Value>,
        feedback: HapticFeedback? = .selection,
        @ViewBuilder illustration: @escaping (SelectOption<Value>) -> Illustration
    ) {
        let set = SelectBinding.single(selection)
        self.init(Text(title), options, set, .single, feedback, illustration)
    }

    /// Any number of choices, with a localized group name and an illustration per option.
    public init(
        _ title: LocalizedStringKey,
        options: [SelectOption<Value>],
        selection: Binding<Set<Value>>,
        feedback: HapticFeedback? = .selection,
        @ViewBuilder illustration: @escaping (SelectOption<Value>) -> Illustration
    ) {
        self.init(Text(title), options, selection, .multiple, feedback, illustration)
    }

    /// One choice, always set, named as is, with an illustration per option.
    public init(
        verbatim title: String,
        options: [SelectOption<Value>],
        selection: Binding<Value>,
        feedback: HapticFeedback? = .selection,
        @ViewBuilder illustration: @escaping (SelectOption<Value>) -> Illustration
    ) {
        let set = SelectBinding.single(selection)
        self.init(Text(verbatim: title), options, set, .single, feedback, illustration)
    }

    /// Any number of choices, named as is, with an illustration per option.
    public init(
        verbatim title: String,
        options: [SelectOption<Value>],
        selection: Binding<Set<Value>>,
        feedback: HapticFeedback? = .selection,
        @ViewBuilder illustration: @escaping (SelectOption<Value>) -> Illustration
    ) {
        self.init(Text(verbatim: title), options, selection, .multiple, feedback, illustration)
    }

    init(
        _ title: Text,
        _ options: [SelectOption<Value>],
        _ selection: Binding<Set<Value>>,
        _ mode: SelectionMode,
        _ feedback: HapticFeedback?,
        _ illustration: @escaping (SelectOption<Value>) -> Illustration
    ) {
        self.title = title
        self.options = options
        self.selection = selection
        self.mode = mode
        self.feedback = feedback
        self.illustration = illustration
    }

    public var body: some View {
        VStack(spacing: Space.md) {
            ForEach(options) { option in
                ChoiceCard(
                    option.title,
                    option.subtitle,
                    option.systemImage,
                    selection.wrappedValue.contains(option.value),
                    mode,
                    {
                        selection.wrappedValue = ChipSelection.toggled(
                            option.value,
                            in: selection.wrappedValue,
                            mode: mode
                        )
                    },
                    illustration(option)
                )
                .disabled(!option.isEnabled)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(title)
        .koboFeedback(feedback, trigger: selection.wrappedValue)
    }
}

extension ChoiceCardGroup where Illustration == EmptyView {
    /// One choice, always set, with a localized group name.
    public init(
        _ title: LocalizedStringKey,
        options: [SelectOption<Value>],
        selection: Binding<Value>,
        feedback: HapticFeedback? = .selection
    ) {
        self.init(Text(title), options, SelectBinding.single(selection), .single, feedback) { _ in EmptyView() }
    }

    /// Any number of choices, with a localized group name.
    public init(
        _ title: LocalizedStringKey,
        options: [SelectOption<Value>],
        selection: Binding<Set<Value>>,
        feedback: HapticFeedback? = .selection
    ) {
        self.init(Text(title), options, selection, .multiple, feedback) { _ in EmptyView() }
    }

    /// One choice, always set, named as is.
    public init(
        verbatim title: String,
        options: [SelectOption<Value>],
        selection: Binding<Value>,
        feedback: HapticFeedback? = .selection
    ) {
        self.init(Text(verbatim: title), options, SelectBinding.single(selection), .single, feedback) { _ in EmptyView()
        }
    }

    /// Any number of choices, named as is.
    public init(
        verbatim title: String,
        options: [SelectOption<Value>],
        selection: Binding<Set<Value>>,
        feedback: HapticFeedback? = .selection
    ) {
        self.init(Text(verbatim: title), options, selection, .multiple, feedback) { _ in EmptyView() }
    }
}

#if DEBUG
    private struct ChoiceCardGroupGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var template = "focus"
        @State private var days: Set<String> = ["focus", "errands"]

        var body: some View {
            ScrollView {
                VStack(alignment: .leading, spacing: Space.xxl) {
                    ChoiceCardGroup("Today's plan", options: SelectionSamples.dayPlans, selection: $template)
                    ChoiceCardGroup(
                        verbatim: "Plan days",
                        options: SelectionSamples.dayPlans,
                        selection: $days
                    ) { option in
                        Text(verbatim: option.value.prefix(1).uppercased())
                            .font(theme.font(.headline))
                            .frame(width: Size.minTouch, height: Size.minTouch)
                            .background(theme.palette.accentSoft, in: RoundedRectangle(cornerRadius: Radius.sm))
                    }
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Choice card group") { ChoiceCardGroupGallery() }
    #Preview("Choice card group · dark, Amber") {
        ChoiceCardGroupGallery().koboTheme(.amber).preferredColorScheme(.dark)
    }
    #Preview("Choice card group · AX3") { ChoiceCardGroupGallery().dynamicTypeSize(.accessibility3) }
#endif
