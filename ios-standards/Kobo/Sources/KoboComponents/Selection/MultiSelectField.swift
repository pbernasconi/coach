import KoboTokens
import SwiftUI

/// A form field that picks any number of options from a sheet of check rows. The closed field summarises the choice:
/// the one title, "All", or a count ("3 selected"), else the placeholder. The sheet stays open while the person ticks
/// rows and searches like `SelectField`'s. VoiceOver reads the label, the summary and any error as one control.
///
///     MultiSelectField("Equipment", selection: $equipment, options: equipmentOptions, placeholder: "None")
///     MultiSelectField(verbatim: group.name, selection: $members, options: members, error: membersError)
public struct MultiSelectField<Value: Hashable & Sendable>: View {
    @State private var isOpen = false
    private let label: OverlayTitle
    private let selection: Binding<Set<Value>>
    private let options: [SelectOption<Value>]
    private let placeholder: Text?
    private let helper: Text?
    private let error: FieldError
    private let searchable: Bool?

    /// A field with localized copy.
    public init(
        _ label: LocalizedStringKey,
        selection: Binding<Set<Value>>,
        options: [SelectOption<Value>],
        placeholder: LocalizedStringKey? = nil,
        helper: LocalizedStringKey? = nil,
        error: FieldError = .none,
        searchable: Bool? = nil
    ) {
        self.label = .localized(label, subtitle: nil)
        self.selection = selection
        self.options = options
        self.placeholder = placeholder.map { Text($0) }
        self.helper = helper.map { Text($0) }
        self.error = error
        self.searchable = searchable
    }

    /// A field whose copy is shown as is.
    public init(
        verbatim label: String,
        selection: Binding<Set<Value>>,
        options: [SelectOption<Value>],
        placeholder: String? = nil,
        helper: String? = nil,
        error: FieldError = .none,
        searchable: Bool? = nil
    ) {
        self.label = .verbatim(label, subtitle: nil)
        self.selection = selection
        self.options = options
        self.placeholder = placeholder.map { Text(verbatim: $0) }
        self.helper = helper.map { Text(verbatim: $0) }
        self.error = error
        self.searchable = searchable
    }

    public var body: some View {
        let summary = self.summary
        SelectFieldBox(label: label.title, helper: helper, error: error, value: summary ?? placeholderText, isOpen: isOpen) {
            Button { isOpen = true } label: {
                SelectValueLabel(value: summary, placeholder: placeholderText)
            }
            .buttonStyle(.plain)
        }
        .sheet(isPresented: $isOpen) {
            KoboSheet(
                title: label,
                detents: SelectSearch.isEnabled(searchable, optionCount: options.count) ? [.large] : [.fitted],
                grabber: .automatic,
                background: .automatic,
                hasChanges: false,
                confirm: nil,
                onClose: nil,
                content: SelectSheet(options: options, selection: selection, searchable: searchable),
                footer: EmptyView()
            )
        }
    }

    private var placeholderText: Text { placeholder ?? Text("None", bundle: .module) }

    /// The closed field's text, or `nil` for the placeholder.
    private var summary: Text? {
        switch SelectSummary.of(selection.wrappedValue, in: options.map(\.value)) {
        case .none: nil
        case .one(let index): options[index].title
        case .all: Text("All", bundle: .module)
        case .count(let count): Text("\(count) selected", bundle: .module)
        }
    }
}

#if DEBUG
    private struct MultiSelectFieldGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var none: Set<String> = []
        @State private var one: Set<String> = ["kettlebell"]
        @State private var some: Set<String> = ["barbell", "bench", "rack"]
        @State private var templates: Set<String> = ["push", "pull", "legs", "rest"]

        var body: some View {
            ScrollView {
                FieldGroup {
                    MultiSelectField(
                        "Equipment",
                        selection: $none,
                        options: SelectionSamples.equipment,
                        placeholder: "Choose what you have",
                        error: none.isEmpty ? .message("Pick at least one") : .none
                    )
                    MultiSelectField("Travel kit", selection: $one, options: SelectionSamples.equipment)
                    MultiSelectField("Home gym", selection: $some, options: SelectionSamples.equipment, helper: "Shown on every plan")
                    MultiSelectField(verbatim: "Plan days", selection: $templates, options: SelectionSamples.dayTemplates)
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Multi-select field") { MultiSelectFieldGallery() }
    #Preview("Multi-select field · dark") { MultiSelectFieldGallery().preferredColorScheme(.dark) }
    #Preview("Multi-select field · AX3") { MultiSelectFieldGallery().dynamicTypeSize(.accessibility3) }
#endif
