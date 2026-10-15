import KoboTokens
import SwiftUI

/// A search input in the page: a pill with the search glyph, the query, a clear button and, with `onCancel`, a round
/// cancel button beside it while the field has focus or holds a query. The Search key submits. No autocapitalisation
/// or autocorrection, as the system search field. The caller filters (and debounces) as `text` changes. A screen that
/// is a searchable list uses `koboSearchable` instead; the read-only form opens a search mode on a tap.
///
///     SearchField(text: $query, prompt: "Search exercises")
///     SearchField(text: $query, onCancel: { query = ""; focus = false }).focused(by: $focus)
///     SearchField(verbatim: committedQuery, prompt: "Search history", onClear: clear) { isSearching = true }
public struct SearchField: View {
    private enum Mode {
        case editable(text: Binding<String>, onSubmit: (() -> Void)?, onCancel: (() -> Void)?)
        case readOnly(query: String, onClear: (() -> Void)?, action: () -> Void)
    }

    private let prompt: Text
    private let mode: Mode
    private var focusLink: FieldFocusLink?

    /// An editable search field.
    ///
    /// - Parameters:
    ///   - prompt: the placeholder; the library's "Search" when `nil`.
    ///   - onSubmit: the Search key.
    ///   - onCancel: adds the cancel button; the caller clears the query and ends the search.
    public init(
        text: Binding<String>,
        prompt: LocalizedStringKey? = nil,
        onSubmit: (() -> Void)? = nil,
        onCancel: (() -> Void)? = nil
    ) {
        self.prompt = prompt.map { Text($0) } ?? Text("Search", bundle: .module)
        mode = .editable(text: text, onSubmit: onSubmit, onCancel: onCancel)
    }

    /// A read-only pill that shows the committed `query` (or the prompt) and calls `action` on a tap, to open a search
    /// mode. With `onClear`, a clear button removes the query in one tap, with no keyboard.
    public init(
        verbatim query: String,
        prompt: LocalizedStringKey? = nil,
        onClear: (() -> Void)? = nil,
        action: @escaping () -> Void
    ) {
        self.prompt = prompt.map { Text($0) } ?? Text("Search", bundle: .module)
        mode = .readOnly(query: query, onClear: onClear, action: action)
    }

    public var body: some View {
        switch mode {
        case .editable(let text, let onSubmit, let onCancel):
            EditableSearchPill(
                text: text,
                prompt: prompt,
                onSubmit: onSubmit,
                onCancel: onCancel,
                focusLink: focusLink
            )
        case .readOnly(let query, let onClear, let action):
            ReadOnlySearchPill(query: query, prompt: prompt, onClear: onClear, action: action)
        }
    }
}

extension SearchField {
    /// Links an editable field to a screen's `Bool` focus state, so a search screen can open with the keyboard up.
    public func focused(by binding: FocusState<Bool>.Binding) -> SearchField {
        var field = self
        field.focusLink = .bool(binding)
        return field
    }
}

/// The editable pill and its cancel button (`SearchFieldLogic`).
private struct EditableSearchPill: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var isFocused: Bool
    let text: Binding<String>
    let prompt: Text
    let onSubmit: (() -> Void)?
    let onCancel: (() -> Void)?
    let focusLink: FieldFocusLink?

    var body: some View {
        HStack(spacing: Space.md) {
            HStack(spacing: Space.sm) {
                SearchGlyph()
                TextField(text: text, prompt: prompt.foregroundStyle(theme.palette.textTertiary)) { prompt }
                    .labelsHidden()
                    .focused($isFocused)
                    .submitLabel(.search)
                    .onSubmit { onSubmit?() }
                    .autocorrectionDisabled()
                    .searchCapitalization()
                    .font(theme.font(.body))
                    .foregroundStyle(theme.palette.textPrimary)
                    .tint(theme.palette.accent)
                    .accessibilityAddTraits(.isSearchField)
                if SearchFieldLogic.showsClear(
                    query: text.wrappedValue,
                    isFocused: isFocused,
                    hasCancel: onCancel != nil
                ) {
                    FieldIconButton(systemImage: "xmark.circle.fill", label: Text("Clear search", bundle: .module)) {
                        text.wrappedValue = ""
                    }
                    .padding(.trailing, -Space.md)
                }
            }
            .searchPill(isFocused: isFocused)
            if let onCancel, SearchFieldLogic.showsCancel(query: text.wrappedValue, isFocused: isFocused) {
                SearchCancelButton {
                    onCancel()
                    isFocused = false
                }
                .transition(Motion.pop(reduceMotion: reduceMotion))
            }
        }
        .koboAnimation(.state, value: SearchFieldLogic.showsCancel(query: text.wrappedValue, isFocused: isFocused))
        .fieldFocusSync(focusLink, isFocused: $isFocused)
    }
}
