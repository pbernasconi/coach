import KoboTokens
import SwiftUI

/// The list of options a select opens, for the content of a `.koboSheet`: radio rows for one choice, check rows for
/// several. With many options (from `SelectSheet.searchThreshold`, or with `search: .visible`) a search field
/// filters them by title, subtitle and keywords, best match first, with the matched letters in bold; an empty result
/// says so. A single pick lands at the tap and the sheet closes a moment later (`Motion.Duration.pickHold`), so the
/// disc fills first; a multiple choice stays open until the person closes it. `SelectField` and `MultiSelectField` use
/// it; use it directly for a choice opened from a button or a toolbar.
///
///     .koboSheet(isPresented: $choosingRest, title: "Default rest") {
///         SelectSheet(options: restOptions, selection: $rest)
///     }
///     .koboSheet(isPresented: $filtering, title: "Equipment", detents: [.large]) {
///         SelectSheet(options: equipment, selection: $equipment)   // Set<String>: check rows
///     }
public struct SelectSheet<Value: Hashable & Sendable>: View {
    private enum Mode {
        case single(Binding<Value?>)
        case multiple(Binding<Set<Value>>)
    }

    @Environment(\.koboTheme) private var theme
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var landed: Value?
    private let options: [SelectOption<Value>]
    private let mode: Mode
    private let search: Visibility
    private let searchPrompt: LocalizedStringKey?
    /// Times the pick hold; a ContinuousClock outside tests.
    private let clock: any Clock<Duration> = ContinuousClock()

    /// Search turns on by itself from this many options.
    public static var searchThreshold: Int { SelectSearch.autoThreshold }

    /// One choice that may be empty. A pick closes the sheet.
    public init(
        options: [SelectOption<Value>],
        selection: Binding<Value?>,
        search: Visibility = .automatic,
        searchPrompt: LocalizedStringKey? = nil
    ) {
        self.options = options
        mode = .single(selection)
        self.search = search
        self.searchPrompt = searchPrompt
    }

    /// One choice that always has a value. A pick closes the sheet.
    public init(
        options: [SelectOption<Value>],
        selection: Binding<Value>,
        search: Visibility = .automatic,
        searchPrompt: LocalizedStringKey? = nil
    ) {
        let optional = SelectBinding.optional(selection)
        self.init(options: options, selection: optional, search: search, searchPrompt: searchPrompt)
    }

    /// Any number of choices. Each tap toggles one; the sheet stays open.
    public init(
        options: [SelectOption<Value>],
        selection: Binding<Set<Value>>,
        search: Visibility = .automatic,
        searchPrompt: LocalizedStringKey? = nil
    ) {
        self.options = options
        mode = .multiple(selection)
        self.search = search
        self.searchPrompt = searchPrompt
    }

    public var body: some View {
        let results = SelectSearch.filter(options.map(\.candidate), query: query)
        VStack(alignment: .leading, spacing: Space.md) {
            if SelectSearch.isEnabled(search.preference, optionCount: options.count) {
                SearchField(text: $query, prompt: searchPrompt)
            }
            if results.isEmpty, !SearchMatch.tokens(query).isEmpty {
                Text("No matches for “\(query)”", bundle: .module)
                    .font(theme.font(.subheadline))
                    .foregroundStyle(theme.palette.textSecondary)
                    .frame(maxWidth: .infinity, minHeight: Size.rowMinHeight)
            } else {
                VStack(spacing: 0) {
                    ForEach(results, id: \.index) { result in
                        row(options[result.index], ranges: result.titleRanges)
                    }
                }
                .padding(.horizontal, -Space.lg)  // rows pad themselves; keep their text on the sheet's gutter
            }
        }
        .allowsHitTesting(landed == nil)
        .task(id: landed) { await closeAfterPick() }
    }

    @ViewBuilder private func row(_ option: SelectOption<Value>, ranges: [Range<String.Index>]) -> some View {
        let title = SelectHighlight.title(option, ranges: ranges)
        switch mode {
        case .single(let selection):
            RadioRow(
                title,
                option.subtitle,
                option.systemImage,
                isChosen(option.value, selection),
                {
                    choose(option.value, selection)
                },
                EmptyView()
            )
            .disabled(!option.isEnabled)
        case .multiple(let selection):
            CheckRow(
                title: title,
                subtitle: option.subtitle,
                state: state(option.value, selection),
                leading: symbol(option)
            )
            .disabled(!option.isEnabled)
        }
    }

    @ViewBuilder private func symbol(_ option: SelectOption<Value>) -> some View {
        if let systemImage = option.systemImage {
            Image(systemName: systemImage).accessibilityHidden(true)
        }
    }

    private func isChosen(_ value: Value, _ selection: Binding<Value?>) -> Bool {
        (landed ?? selection.wrappedValue) == value
    }

    private func choose(_ value: Value, _ selection: Binding<Value?>) {
        guard landed == nil else { return }
        landed = value
        selection.wrappedValue = value
    }

    private func state(_ value: Value, _ selection: Binding<Set<Value>>) -> Binding<CheckboxState> {
        Binding(
            get: { CheckboxState(selection.wrappedValue.contains(value)) },
            set: { _ in
                selection.wrappedValue = ChipSelection.toggled(value, in: selection.wrappedValue, mode: .multiple)
            }
        )
    }

    private func closeAfterPick() async {
        guard landed != nil else { return }
        guard (try? await clock.sleep(for: .seconds(Motion.Duration.pickHold))) != nil else { return }
        dismiss()
    }
}

#if DEBUG
    private struct SelectSheetGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var choosingRest = true
        @State private var filtering = false
        @State private var rest = 90
        @State private var equipment: Set<String> = ["barbell"]

        var body: some View {
            VStack(spacing: Space.lg) {
                Button("Default rest: \(rest) s") { choosingRest = true }
                Button("Equipment (\(equipment.count))") { filtering = true }
            }
            .buttonStyle(.kobo(.secondary))
            .padding(Space.gutter)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(theme.palette.canvas)
            .koboSheet(isPresented: $choosingRest, title: "Default rest") {
                SelectSheet(options: SelectionSamples.restPresets, selection: $rest)
            }
            .koboSheet(isPresented: $filtering, title: "Equipment", detents: [.large]) {
                SelectSheet(
                    options: SelectionSamples.equipment,
                    selection: $equipment,
                    searchPrompt: "Search equipment"
                )
            }
        }
    }

    #Preview("Select sheet") { SelectSheetGallery() }
    #Preview("Select sheet · dark, Amber") { SelectSheetGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Select sheet · AX3") { SelectSheetGallery().dynamicTypeSize(.accessibility3) }
#endif
