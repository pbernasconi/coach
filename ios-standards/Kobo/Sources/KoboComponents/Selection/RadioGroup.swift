import KoboTokens
import SwiftUI

/// A group of `RadioRow`s over one value: exactly one choice is on, a tap moves it and plays the selection haptic, and
/// options that are not enabled dim and take no taps. The group is one accessibility container named by `title`, and
/// each row speaks its title, subtitle and the selected trait, so VoiceOver and Full Keyboard Access move row by row.
/// Put it in a `ListSection` for the card and separators.
///
///     ListSection("Default timer") {
///         RadioGroup("Default timer", options: timerOptions, selection: $timer)
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
        @State private var timer = 90
        @State private var day = "focus"

        var body: some View {
            ScrollView {
                VStack(spacing: Space.xxl) {
                    ListSection("Default timer", footer: "Applies to new tasks.") {
                        RadioGroup("Default timer", options: SelectionSamples.timerPresets, selection: $timer)
                    }
                    ListSection(verbatim: "Weekday plan") {
                        RadioGroup(verbatim: "Weekday plan", options: SelectionSamples.dayPlans, selection: $day)
                    }
                }
                .padding(.vertical, Space.gutter)
                .pageGutter()
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("Radio group") { RadioGroupGallery() }
    #Preview("Radio group · dark, Amber") { RadioGroupGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Radio group · AX3") { RadioGroupGallery().dynamicTypeSize(.accessibility3) }
#endif
