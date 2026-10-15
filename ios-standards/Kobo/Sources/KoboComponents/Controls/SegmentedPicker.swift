import KoboTokens
import SwiftUI

/// A pill switcher: equal-width segments on a sunken track, with a selection pill that slides between them on
/// `Motion.snappy`. VoiceOver reads it as a native segmented picker. Use it to switch views of the same content;
/// for a choice that changes a form, prefer `ChipGroup`.
///
///     SegmentedPicker("Range", selection: $range, options: [
///         ChoiceOption(.week, title: "Week"), ChoiceOption(.month, title: "Month"),
///     ])
public struct SegmentedPicker<Value: Hashable & Sendable>: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.colorScheme) private var colorScheme
    @Namespace private var namespace
    private let title: LocalizedStringKey
    private let selection: Binding<Value>
    private let options: [ChoiceOption<Value>]
    private let feedback: HapticFeedback?

    /// `title` names the picker for VoiceOver; it is not shown.
    public init(
        _ title: LocalizedStringKey,
        selection: Binding<Value>,
        options: [ChoiceOption<Value>],
        feedback: HapticFeedback? = .selection
    ) {
        self.title = title
        self.selection = selection
        self.options = options
        self.feedback = feedback
    }

    public var body: some View {
        HStack(spacing: Space.xxs) {
            ForEach(options) { option in
                segment(option, isSelected: option.value == selection.wrappedValue)
            }
        }
        .padding(Space.xxs)
        .background(theme.palette.surfaceRaised, in: Capsule())
        .koboAnimation(.snappy, value: selection.wrappedValue)
        .koboFeedback(feedback, trigger: selection.wrappedValue)
        .accessibilityRepresentation {
            Picker(selection: selection) {
                ForEach(options) { option in
                    option.title.tag(option.value)
                }
            } label: {
                Text(title)
            }
            .pickerStyle(.segmented)
        }
    }

    private func segment(_ option: ChoiceOption<Value>, isSelected: Bool) -> some View {
        Button {
            selection.wrappedValue = option.value
        } label: {
            HStack(spacing: Space.xs) {
                if let systemImage = option.systemImage {
                    Image(systemName: systemImage).imageScale(.small).accessibilityHidden(true)
                }
                option.title.multilineTextAlignment(.center)
            }
            .font(theme.font(.subheadline).weight(.semibold))
            .foregroundStyle(isSelected ? theme.palette.textPrimary : theme.palette.textSecondary)
            .padding(.horizontal, Space.sm)
            .padding(.vertical, Space.xs)
            .frame(maxWidth: .infinity, minHeight: Size.minTouch - Space.xxs * 2)
            .background {
                if isSelected {
                    Capsule()
                        .fill(indicatorFill)
                        .shadow(color: theme.palette.scrim, radius: Space.xs, y: Space.xxs)
                        .matchedGeometryEffect(id: SelectionIndicator.id, in: namespace)
                }
            }
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    /// The pill reads lighter than the track in both appearances.
    private var indicatorFill: Color {
        colorScheme == .dark ? theme.palette.surfaceSunken : theme.palette.surface
    }
}

private enum SelectionIndicator {
    static let id = "selection"
}

#if DEBUG
    private struct SegmentedPickerGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var range = "week"
        @State private var unit = "kg"

        var body: some View {
            VStack(spacing: Space.lg) {
                SegmentedPicker(
                    "Range",
                    selection: $range,
                    options: [
                        ChoiceOption("week", title: "Week"),
                        ChoiceOption("exercises", title: "Exercises"),
                        ChoiceOption("days", title: "Days"),
                    ]
                )
                SegmentedPicker(
                    "Unit",
                    selection: $unit,
                    options: [
                        ChoiceOption("kg", verbatim: "kg", systemImage: "scalemass"),
                        ChoiceOption("lb", verbatim: "lb"),
                    ]
                )
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Segmented picker") { SegmentedPickerGallery() }
    #Preview("Segmented picker · dark") { SegmentedPickerGallery().preferredColorScheme(.dark) }
    #Preview("Segmented picker · AX3") { SegmentedPickerGallery().dynamicTypeSize(.accessibility3) }
#endif
