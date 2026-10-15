import KoboTokens
import SwiftUI

/// A group of `RadioRow`s over one value: exactly one choice is on, a tap moves it and plays the selection haptic, and
/// options that are not enabled dim and take no taps. The group is one accessibility container named by `title`, and
/// each row speaks its title, subtitle and the selected trait, so VoiceOver and Full Keyboard Access move row by row.
/// Put it in a `ListSection` for the card and separators.
///
///     ListSection("Default rest") {
///         RadioGroup("Default rest", options: restOptions, selection: $rest)
///     }
///     RadioGroup(verbatim: plan.name, options: days.map { SelectOption($0) }, selection: $day)
public struct RadioGroup<Value: Hashable & Sendable>: View {
    private let title: Text
    private let options: [SelectOption<Value>]
    private let selection: Binding<Value>

    /// A group named for VoiceOver by a localized title (not shown; the section header shows it).
    public init(_ title: LocalizedStringKey, options: [SelectOption<Value>], selection: Binding<Value>) {
        self.title = Text(title)
        self.options = options
        self.selection = selection
    }

    /// A group named as is (a plan name).
    public init(verbatim title: String, options: [SelectOption<Value>], selection: Binding<Value>) {
        self.title = Text(verbatim: title)
        self.options = options
        self.selection = selection
    }

    public var body: some View {
        VStack(spacing: 0) {
            ForEach(options) { option in
                RadioRow(
                    option.title,
                    option.subtitle,
                    option.systemImage,
                    option.value == selection.wrappedValue,
                    { selection.wrappedValue = option.value },
                    EmptyView()
                )
                .disabled(!option.isEnabled)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(title)
    }
}

#if DEBUG
    private struct RadioGroupGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var rest = 90
        @State private var day = "push"

        var body: some View {
            ScrollView {
                VStack(spacing: Space.xxl) {
                    ListSection("Default rest", footer: "Applies to new exercises.") {
                        RadioGroup("Default rest", options: SelectionSamples.restPresets, selection: $rest)
                    }
                    ListSection(verbatim: "Upper / lower") {
                        RadioGroup(verbatim: "Upper / lower", options: SelectionSamples.dayTemplates, selection: $day)
                    }
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Radio group") { RadioGroupGallery() }
    #Preview("Radio group · dark, Lift") { RadioGroupGallery().koboTheme(.lift).preferredColorScheme(.dark) }
    #Preview("Radio group · AX3") { RadioGroupGallery().dynamicTypeSize(.accessibility3) }
#endif
