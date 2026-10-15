import KoboTokens
import SwiftUI

/// A form field that picks one option from a sheet: the label above, the chosen title (or the placeholder) in a field
/// box with an up-down caret, and the helper or error line under it, like every Kobo field. A tap opens a
/// `SelectSheet` titled with the label; from `SelectSheet.searchThreshold` options (or with `search: .visible`) the
/// sheet opens tall with a search field. The pick lands at the tap and the sheet closes itself. VoiceOver reads the
/// label, the value and any error as one control. For a short list of plain values, `MenuSelectField` opens a native
/// menu instead; for several choices use `MultiSelectField`.
///
///     SelectField("Equipment", selection: $equipment, options: equipmentOptions, placeholder: "Choose equipment")
///     SelectField("Default rest", selection: $rest, options: restOptions, helper: "Used for new exercises")
///     SelectField(verbatim: plan.name, selection: $day, options: days, error: dayError)
public struct SelectField<Value: Hashable & Sendable>: View {
    @State private var isOpen = false
    private let label: OverlayTitle
    private let selection: Binding<Value?>
    private let options: [SelectOption<Value>]
    private let placeholder: Text?
    private let helper: Text?
    private let error: FieldError
    private let search: Visibility

    /// A field over a choice that may be empty, with localized copy.
    public init(
        _ label: LocalizedStringKey,
        selection: Binding<Value?>,
        options: [SelectOption<Value>],
        placeholder: LocalizedStringKey? = nil,
        helper: LocalizedStringKey? = nil,
        error: FieldError = .none,
        search: Visibility = .automatic
    ) {
        self.label = .localized(label, subtitle: nil)
        self.selection = selection
        self.options = options
        self.placeholder = placeholder.map { Text($0) }
        self.helper = helper.map { Text($0) }
        self.error = error
        self.search = search
    }

    /// A field over a choice that may be empty, with copy shown as is.
    public init(
        verbatim label: String,
        selection: Binding<Value?>,
        options: [SelectOption<Value>],
        placeholder: String? = nil,
        helper: String? = nil,
        error: FieldError = .none,
        search: Visibility = .automatic
    ) {
        self.label = .verbatim(label, subtitle: nil)
        self.selection = selection
        self.options = options
        self.placeholder = placeholder.map { Text(verbatim: $0) }
        self.helper = helper.map { Text(verbatim: $0) }
        self.error = error
        self.search = search
    }

    /// A field over a choice that always has a value (a default rest), with localized copy.
    public init(
        _ label: LocalizedStringKey,
        selection: Binding<Value>,
        options: [SelectOption<Value>],
        helper: LocalizedStringKey? = nil,
        error: FieldError = .none,
        search: Visibility = .automatic
    ) {
        let optional = SelectBinding.optional(selection)
        self.init(label, selection: optional, options: options, helper: helper, error: error, search: search)
    }

    /// A field over a choice that always has a value, with copy shown as is.
    public init(
        verbatim label: String,
        selection: Binding<Value>,
        options: [SelectOption<Value>],
        helper: String? = nil,
        error: FieldError = .none,
        search: Visibility = .automatic
    ) {
        let optional = SelectBinding.optional(selection)
        self.init(
            verbatim: label,
            selection: optional,
            options: options,
            helper: helper,
            error: error,
            search: search
        )
    }

    public var body: some View {
        let chosen = options.first { $0.value == selection.wrappedValue }
        SelectFieldBox(label: label.title, helper: helper, error: error, value: shown(chosen), isOpen: isOpen) {
            Button {
                isOpen = true
            } label: {
                SelectValueLabel(value: chosen?.title, placeholder: placeholderText)
            }
            .buttonStyle(.plain)
        }
        .sheet(isPresented: $isOpen) {
            KoboSheet(
                title: label,
                detents: isSearchable ? [.large] : [.fitted],
                grabber: .automatic,
                background: .automatic,
                hasChanges: false,
                confirm: nil,
                onClose: nil,
                content: SelectSheet(options: options, selection: selection, search: search),
                footer: EmptyView()
            )
        }
    }

    private var isSearchable: Bool { SelectSearch.isEnabled(search.preference, optionCount: options.count) }

    private var placeholderText: Text { placeholder ?? Text("Select", bundle: .module) }

    private func shown(_ chosen: SelectOption<Value>?) -> Text { chosen?.title ?? placeholderText }
}

#if DEBUG
    private struct SelectFieldGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var equipment: String?
        @State private var rest = 90
        @State private var day: String? = "pull"
        @State private var gear: Set<String> = ["barbell", "bench", "rack"]

        var body: some View {
            ScrollView {
                FieldGroup {
                    SelectField(
                        "Equipment",
                        selection: $equipment,
                        options: SelectionSamples.equipment,
                        placeholder: "Choose equipment",
                        error: equipment == nil ? .message("Pick the equipment for this exercise") : .none
                    )
                    SelectField(
                        "Default rest",
                        selection: $rest,
                        options: SelectionSamples.restPresets,
                        helper: "Used for new exercises"
                    )
                    SelectField(verbatim: "Day template", selection: $day, options: SelectionSamples.dayTemplates)
                    MultiSelectField(
                        "Gym equipment",
                        selection: $gear,
                        options: SelectionSamples.equipment,
                        placeholder: "None yet"
                    )
                    SelectField("Locked", selection: $rest, options: SelectionSamples.restPresets).disabled(true)
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Select field") { SelectFieldGallery() }
    #Preview("Select field · dark, Amber") { SelectFieldGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Select field · AX3") { SelectFieldGallery().dynamicTypeSize(.accessibility3) }
#endif
