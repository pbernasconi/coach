import KoboTokens
import SwiftUI

/// The closed look every select field shares (`SelectField`, `MultiSelectField`, `MenuSelectField`): a `FieldFrame`
/// box with the label above and the helper or error line under it, holding a control (a button that opens a sheet, or
/// a native menu) that fills the whole box. The control speaks the label, the shown value with the error, and the
/// helper as its hint. The box takes the focus ring while its sheet is open.
struct SelectFieldBox<Control: View>: View {
    private let label: Text?
    private let helper: Text?
    private let error: FieldError
    private let value: Text
    private let isOpen: Bool
    private let control: Control

    init(
        label: Text?,
        helper: Text?,
        error: FieldError,
        value: Text,
        isOpen: Bool,
        @ViewBuilder control: () -> Control
    ) {
        self.label = label
        self.helper = helper
        self.error = error
        self.value = value
        self.isOpen = isOpen
        self.control = control()
    }

    var body: some View {
        FieldFrame(label: label, helper: helper, error: error, isFocused: isOpen, value: nil) {
            control
                .padding(.horizontal, -Space.lg)  // the frame pads its box; the control fills it edge to edge
                .accessibilityLabel(label ?? Text(verbatim: ""))
                .accessibilityValue(spokenValue)
                .accessibilityHint(helper ?? Text(verbatim: ""))
        }
    }

    /// "Wi-Fi", or "Wi-Fi, Pick at least one" with an error.
    private var spokenValue: Text {
        guard let message = error.message else { return value }
        return Text("\(value), \(message)", bundle: .module)
    }
}

/// What a closed select field shows: the chosen value in the primary ink, or the placeholder in the tertiary ink,
/// then the up-down caret. Two lines at accessibility sizes, so a long choice is not cut; the box grows.
struct SelectValueLabel: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let value: Text?
    let placeholder: Text

    var body: some View {
        HStack(spacing: Space.sm) {
            (value ?? placeholder)
                .font(theme.font(.body))
                .foregroundStyle(ink)
                .lineLimit(dynamicTypeSize.isAccessibilitySize ? 2 : 1)
                .frame(maxWidth: .infinity, alignment: .leading)
            SelectCaret()
        }
        .padding(.horizontal, Space.lg)
        .padding(.vertical, Space.sm)
        .frame(maxWidth: .infinity, minHeight: Size.buttonHeight, alignment: .leading)
        .contentShape(Rectangle())
    }

    private var ink: Color {
        value == nil || !isEnabled ? theme.palette.textTertiary : theme.palette.textPrimary
    }
}

/// The up-down glyph of a control that opens a list of choices (a sheet or a menu), not a page. Decorative.
struct SelectCaret: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        Image(systemName: "chevron.up.chevron.down")
            .font(theme.font(.footnote).weight(.semibold))
            .foregroundStyle(isEnabled ? theme.palette.textSecondary : theme.palette.textTertiary)
            .accessibilityHidden(true)
    }
}

/// Binding adapters shared by the select family.
enum SelectBinding {
    /// A one-value binding seen as an optional one; clearing it is ignored.
    static func optional<Value>(_ selection: Binding<Value>) -> Binding<Value?> {
        Binding(get: { selection.wrappedValue }, set: { if let value = $0 { selection.wrappedValue = value } })
    }

    /// A one-value binding seen as a set of exactly one (`ChipSelection` in `.single` mode keeps one).
    static func single<Value: Hashable>(_ selection: Binding<Value>) -> Binding<Set<Value>> {
        Binding(get: { [selection.wrappedValue] }, set: { if let first = $0.first { selection.wrappedValue = first } })
    }
}

extension Visibility {
    /// The search preference of a select sheet: `.automatic` turns search on from `SelectSheet.searchThreshold`
    /// options.
    var preference: SelectSearch.Preference {
        switch self {
        case .visible: .shown
        case .hidden: .hidden
        default: .automatic
        }
    }
}
