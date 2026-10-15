import KoboTokens
import SwiftUI

/// A settings row whose value opens a native menu of choices: units, default rest, a start day. It looks like a
/// `ListRow` (leading slot, title, subtitle) with the chosen title and an up-down caret on the trailing edge, draws its
/// separator and press fill inside a `ListSection`, and the menu shows a check beside the current choice. A change plays
/// the selection haptic. VoiceOver reads the title and the chosen value; the menu is the system one.
///
///     MenuRow("Units", selection: $unit, options: [ChoiceOption(.kg, title: "Kilograms"), ChoiceOption(.lb, title: "Pounds")])
///     MenuRow("Default rest", selection: $rest, options: restOptions) { Image(systemName: "timer") }
public struct MenuRow<Value: Hashable & Sendable, Leading: View>: View {
    @Environment(\.koboTheme) private var theme
    private let title: Text
    private let subtitle: Text?
    private let selection: Binding<Value>
    private let options: [ChoiceOption<Value>]
    private let feedback: HapticFeedback?
    private let leading: Leading

    /// A row with a localized title and subtitle and a leading slot.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        selection: Binding<Value>,
        options: [ChoiceOption<Value>],
        feedback: HapticFeedback? = .selection,
        @ViewBuilder leading: () -> Leading
    ) {
        let subtitle = subtitle.map { Text($0) }
        self.init(Text(title), subtitle, selection, options, feedback, leading())
    }

    /// A row whose title and subtitle are shown as is, with a leading slot.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        selection: Binding<Value>,
        options: [ChoiceOption<Value>],
        feedback: HapticFeedback? = .selection,
        @ViewBuilder leading: () -> Leading
    ) {
        let subtitle = subtitle.map { Text(verbatim: $0) }
        self.init(Text(verbatim: title), subtitle, selection, options, feedback, leading())
    }

    private init(
        _ title: Text,
        _ subtitle: Text?,
        _ selection: Binding<Value>,
        _ options: [ChoiceOption<Value>],
        _ feedback: HapticFeedback?,
        _ leading: Leading
    ) {
        self.title = title
        self.subtitle = subtitle
        self.selection = selection
        self.options = options
        self.feedback = feedback
        self.leading = leading
    }

    public var body: some View {
        Menu {
            ChoiceMenuPicker(title: title, selection: selection, options: options)
        } label: {
            ListRow(title: title, subtitle: subtitle, value: nil, action: nil, leading: leading, trailing: value)
        }
        .menuStyle(.button)
        .buttonStyle(ListRowButtonStyle())
        .koboFeedback(feedback, trigger: selection.wrappedValue)
    }

    private var value: some View {
        HStack(spacing: Space.xs) {
            (options.first { $0.value == selection.wrappedValue }?.title ?? Text(verbatim: ""))
                .font(theme.font(.body))
                .foregroundStyle(theme.palette.textSecondary)
                .multilineTextAlignment(.trailing)
            SelectCaret()
        }
    }
}

extension MenuRow where Leading == EmptyView {
    /// A row with a localized title and subtitle.
    public init(
        _ title: LocalizedStringKey,
        subtitle: LocalizedStringKey? = nil,
        selection: Binding<Value>,
        options: [ChoiceOption<Value>],
        feedback: HapticFeedback? = .selection
    ) {
        self.init(title, subtitle: subtitle, selection: selection, options: options, feedback: feedback) { EmptyView() }
    }

    /// A row whose title and subtitle are shown as is.
    public init(
        verbatim title: String,
        subtitle: String? = nil,
        selection: Binding<Value>,
        options: [ChoiceOption<Value>],
        feedback: HapticFeedback? = .selection
    ) {
        self.init(verbatim: title, subtitle: subtitle, selection: selection, options: options, feedback: feedback) {
            EmptyView()
        }
    }
}

/// The inline picker inside a choice menu: one item per option, with its symbol, and the system check beside the
/// current one. Shared by `MenuRow` and `MenuSelectField`.
struct ChoiceMenuPicker<Value: Hashable & Sendable, Tag: Hashable>: View {
    let title: Text
    let selection: Binding<Tag>
    let options: [ChoiceOption<Value>]
    let tag: (Value) -> Tag

    var body: some View {
        Picker(selection: selection) {
            ForEach(options) { option in
                Group {
                    if let systemImage = option.systemImage {
                        Label {
                            option.title
                        } icon: {
                            Image(systemName: systemImage)
                        }
                    } else {
                        option.title
                    }
                }
                .tag(tag(option.value))
            }
        } label: {
            title
        }
        .pickerStyle(.inline)
    }
}

extension ChoiceMenuPicker where Tag == Value {
    init(title: Text, selection: Binding<Value>, options: [ChoiceOption<Value>]) {
        self.init(title: title, selection: selection, options: options) { $0 }
    }
}

#if DEBUG
    private struct MenuRowGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var unit = "kg"
        @State private var rest = 90
        @State private var week = "monday"

        var body: some View {
            ScrollView {
                ListSection("Workout", footer: "Changes apply to new sessions.") {
                    MenuRow(
                        "Units",
                        selection: $unit,
                        options: [ChoiceOption("kg", title: "Kilograms"), ChoiceOption("lb", title: "Pounds")]
                    )
                    MenuRow(
                        "Default rest",
                        subtitle: "Between working sets",
                        selection: $rest,
                        options: SelectionSamples.restChoices
                    ) {
                        Image(systemName: "timer").accessibilityHidden(true)
                    }
                    MenuRow(
                        verbatim: "Week starts on",
                        selection: $week,
                        options: [ChoiceOption("monday", title: "Monday"), ChoiceOption("sunday", title: "Sunday")]
                    )
                    MenuRow("Plate set", selection: .constant("std"), options: [ChoiceOption("std", title: "Standard")])
                        .disabled(true)
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Menu row") { MenuRowGallery() }
    #Preview("Menu row · dark, Lift") { MenuRowGallery().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Menu row · AX3") { MenuRowGallery().dynamicTypeSize(.accessibility3) }
#endif
