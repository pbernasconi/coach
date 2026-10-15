import KoboTokens
import SwiftUI

/// A pill switcher: equal-width segments on a raised track (`surfaceRaised`), with a selection pill that slides
/// between them on `Motion.snappy`. The pill is `surface` in light mode and `surfaceSunken` in dark mode, the two
/// tones that read lighter than the raised track in each appearance. VoiceOver reads it as a native segmented
/// picker. A tap that changes the choice plays `feedback`; a change made in code plays nothing. At accessibility text
/// sizes the segments stack full width so a long title wraps instead of squeezing. Use it to switch views of the same
/// content; for a choice that changes a form, prefer `ChipGroup`.
///
///     SegmentedPicker("Range", selection: $range, options: [
///         ChoiceOption(.week, title: "Week"), ChoiceOption(.month, title: "Month"),
///     ])
///     SegmentedPicker(verbatim: group.name, selection: $member, options: members)
public struct SegmentedPicker<Value: Hashable & Sendable>: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Namespace private var namespace
    /// Counts the taps that changed the choice: only a tap plays the haptic.
    @State private var changeTaps = 0
    private let title: Text
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
        self.init(title: Text(title), selection: selection, options: options, feedback: feedback)
    }

    /// A picker named as is (user data); the name is read by VoiceOver, not shown.
    public init(
        verbatim title: String,
        selection: Binding<Value>,
        options: [ChoiceOption<Value>],
        feedback: HapticFeedback? = .selection
    ) {
        self.init(title: Text(verbatim: title), selection: selection, options: options, feedback: feedback)
    }

    private init(title: Text, selection: Binding<Value>, options: [ChoiceOption<Value>], feedback: HapticFeedback?) {
        self.title = title
        self.selection = selection
        self.options = options
        self.feedback = feedback
    }

    public var body: some View {
        let stacks = dynamicTypeSize.isAccessibilitySize
        let layout = stacks ? AnyLayout(VStackLayout(spacing: Space.xxs)) : AnyLayout(HStackLayout(spacing: Space.xxs))
        layout {
            ForEach(options) { option in
                segment(option, isSelected: option.value == selection.wrappedValue)
            }
        }
        .padding(Space.xxs)
        .background(theme.palette.surfaceRaised, in: RoundedRectangle(cornerRadius: trackRadius, style: .continuous))
        .koboAnimation(.snappy, value: selection.wrappedValue)
        .koboFeedback(feedback, trigger: changeTaps)
        .accessibilityRepresentation {
            Picker(selection: selection) {
                ForEach(options) { option in
                    option.title.tag(option.value)
                }
            } label: {
                title
            }
            .pickerStyle(.segmented)
        }
    }

    private func segment(_ option: ChoiceOption<Value>, isSelected: Bool) -> some View {
        Button {
            guard option.value != selection.wrappedValue else { return }
            changeTaps += 1
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
                    RoundedRectangle(cornerRadius: Radius.concentric(outer: trackRadius, inset: Space.xxs))
                        .fill(indicatorFill)
                        .shadow(color: theme.palette.scrim, radius: Space.xs, y: Space.xxs)
                        .matchedGeometryEffect(id: SelectionIndicator.id, in: namespace)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    /// A capsule while the segments sit in one row; stacked segments keep large rounded corners instead.
    private var trackRadius: CGFloat {
        dynamicTypeSize.isAccessibilitySize ? Radius.lg : Radius.pill
    }

    /// The pill reads lighter than the raised track in both appearances (dark `surfaceSunken` is the lighter grey).
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
        @State private var unit = "km"

        var body: some View {
            VStack(spacing: Space.lg) {
                SegmentedPicker(
                    "Range",
                    selection: $range,
                    options: [
                        ChoiceOption("week", title: "Week"),
                        ChoiceOption("tasks", title: "Tasks"),
                        ChoiceOption("days", title: "Days"),
                    ]
                )
                SegmentedPicker(
                    "Unit",
                    selection: $unit,
                    options: [
                        ChoiceOption("km", verbatim: "km", systemImage: "ruler"),
                        ChoiceOption("mi", verbatim: "mi"),
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
