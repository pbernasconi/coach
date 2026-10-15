import KoboTokens
import SwiftUI

/// A form field that picks one of a few plain values from a native menu: the label above, the chosen title (or the
/// placeholder) in a field box with an up-down caret, and the helper or error line under it, like `SelectField`. The
/// menu shows a check beside the current choice, and a change plays the selection haptic. Use it for short lists with
/// no subtitles (size, side, format); for long or described lists use `SelectField`.
///
///     MenuSelectField("Size", selection: $size, options: sizes, placeholder: "Choose a size")
///     MenuSelectField(verbatim: document.name, selection: $side, options: sides, helper: "For printed copies")
public struct MenuSelectField<Value: Hashable & Sendable>: View {
    private let label: Text
    private let selection: Binding<Value?>
    private let options: [ChoiceOption<Value>]
    private let placeholder: Text?
    private let helper: Text?
    private let error: FieldError
    private let feedback: HapticFeedback?

    /// A field over a choice that may be empty, with localized copy.
    public init(
        _ label: LocalizedStringKey,
        selection: Binding<Value?>,
        options: [ChoiceOption<Value>],
        placeholder: LocalizedStringKey? = nil,
        helper: LocalizedStringKey? = nil,
        error: FieldError = .none,
        feedback: HapticFeedback? = .selection
    ) {
        self.init(
            label: Text(label),
            placeholder: placeholder.map { Text($0) },
            helper: helper.map { Text($0) },
            selection: selection,
            options: options,
            error: error,
            feedback: feedback
        )
    }

    /// A field over a choice that may be empty, with copy shown as is.
    public init(
        verbatim label: String,
        selection: Binding<Value?>,
        options: [ChoiceOption<Value>],
        placeholder: String? = nil,
        helper: String? = nil,
        error: FieldError = .none,
        feedback: HapticFeedback? = .selection
    ) {
        self.init(
            label: Text(verbatim: label),
            placeholder: placeholder.map { Text(verbatim: $0) },
            helper: helper.map { Text(verbatim: $0) },
            selection: selection,
            options: options,
            error: error,
            feedback: feedback
        )
    }

    /// A field over a choice that always has a value, with localized copy.
    public init(
        _ label: LocalizedStringKey,
        selection: Binding<Value>,
        options: [ChoiceOption<Value>],
        helper: LocalizedStringKey? = nil,
        error: FieldError = .none,
        feedback: HapticFeedback? = .selection
    ) {
        self.init(
            label: Text(label),
            placeholder: nil,
            helper: helper.map { Text($0) },
            selection: SelectBinding.optional(selection),
            options: options,
            error: error,
            feedback: feedback
        )
    }

    /// A field over a choice that always has a value, with copy shown as is.
    public init(
        verbatim label: String,
        selection: Binding<Value>,
        options: [ChoiceOption<Value>],
        helper: String? = nil,
        error: FieldError = .none,
        feedback: HapticFeedback? = .selection
    ) {
        self.init(
            label: Text(verbatim: label),
            placeholder: nil,
            helper: helper.map { Text(verbatim: $0) },
            selection: SelectBinding.optional(selection),
            options: options,
            error: error,
            feedback: feedback
        )
    }

    private init(
        label: Text,
        placeholder: Text?,
        helper: Text?,
        selection: Binding<Value?>,
        options: [ChoiceOption<Value>],
        error: FieldError,
        feedback: HapticFeedback?
    ) {
        self.label = label
        self.placeholder = placeholder
        self.helper = helper
        self.selection = selection
        self.options = options
        self.error = error
        self.feedback = feedback
    }

    public var body: some View {
        let chosen = options.first { $0.value == selection.wrappedValue }?.title
        let placeholder = self.placeholder ?? Text("Select", bundle: .module)
        SelectFieldBox(label: label, helper: helper, error: error, value: chosen ?? placeholder, isOpen: false) {
            Menu {
                ChoiceMenuPicker(title: label, selection: selection, options: options) { Optional($0) }
            } label: {
                SelectValueLabel(value: chosen, placeholder: placeholder)
            }
            .menuStyle(.button)
            .buttonStyle(.plain)
        }
        .koboFeedback(feedback, trigger: selection.wrappedValue)
    }
}

#if DEBUG
    private struct MenuSelectFieldGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var size: String?
        @State private var side = "both"
        @State private var snooze = 120

        private let sizes = [
            ChoiceOption("small", title: "Small"),
            ChoiceOption("medium", title: "Medium"),
            ChoiceOption("large", title: "Large", systemImage: "arrow.up.left.and.arrow.down.right"),
        ]
        private let sides = [
            ChoiceOption("both", title: "Both sides"),
            ChoiceOption("front", title: "Front only"),
            ChoiceOption("back", title: "Back only"),
        ]

        var body: some View {
            ScrollView {
                FieldGroup {
                    MenuSelectField(
                        "Size",
                        selection: $size,
                        options: sizes,
                        placeholder: "Choose a size",
                        error: size == nil ? .message("Pick a size") : .none
                    )
                    MenuSelectField("Print", selection: $side, options: sides, helper: "For printed copies")
                    MenuSelectField(
                        verbatim: "Snooze for",
                        selection: $snooze,
                        options: SelectionSamples.timerChoices
                    )
                    MenuSelectField("Locked", selection: $side, options: sides).disabled(true)
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Menu select field") { MenuSelectFieldGallery() }
    #Preview("Menu select field · dark") { MenuSelectFieldGallery().preferredColorScheme(.dark) }
    #Preview("Menu select field · AX3") { MenuSelectFieldGallery().dynamicTypeSize(.accessibility3) }
#endif
