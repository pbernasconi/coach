import KoboTokens
import SwiftUI

/// A row of equal-width chips for one-tap values, such as the amounts around the current one or common counts.
/// The chip matching `selection` is highlighted; a value not in the row highlights none. At accessibility text sizes
/// the chips wrap; when the titles do not fit in one row, they take two even rows. They never squeeze to "…". The
/// row is one container named by `title`; each chip carries the selected trait.
///
///     QuickPickRow("Guests", values: [1, 2, 4, 6, 8], selection: $guests) { "\($0)" }
///     QuickPickRow(verbatim: recipe.name, values: amounts, selection: $amount, format: .number)
public struct QuickPickRow<Value: Hashable & Sendable>: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private let title: Text
    private let items: [QuickPickItem<Value>]
    private let selection: Binding<Value>
    private let feedback: HapticFeedback?
    private let label: (Value) -> String

    /// A row whose chip titles come from `label`. Values must be unique.
    public init(
        _ title: LocalizedStringKey,
        values: [Value],
        selection: Binding<Value>,
        feedback: HapticFeedback? = .selection,
        label: @escaping (Value) -> String
    ) {
        self.init(title: Text(title), values: values, selection: selection, feedback: feedback, label: label)
    }

    /// A row named as is (a recipe name), whose chip titles come from `label`. Values must be unique.
    public init(
        verbatim title: String,
        values: [Value],
        selection: Binding<Value>,
        feedback: HapticFeedback? = .selection,
        label: @escaping (Value) -> String
    ) {
        self.init(title: Text(verbatim: title), values: values, selection: selection, feedback: feedback, label: label)
    }

    /// A row named as is, whose chip titles come from a `FormatStyle`.
    public init<Style: FormatStyle>(
        verbatim title: String,
        values: [Value],
        selection: Binding<Value>,
        feedback: HapticFeedback? = .selection,
        format style: Style
    ) where Style.FormatInput == Value, Style.FormatOutput == String {
        self.init(
            verbatim: title,
            values: values,
            selection: selection,
            feedback: feedback,
            label: { style.format($0) }
        )
    }

    private init(
        title: Text,
        values: [Value],
        selection: Binding<Value>,
        feedback: HapticFeedback?,
        label: @escaping (Value) -> String
    ) {
        self.title = title
        self.items = values.map { QuickPickItem(value: $0) }
        self.selection = selection
        self.feedback = feedback
        self.label = label
    }

    /// A row whose chip titles come from a `FormatStyle`, such as `.number`.
    public init<Style: FormatStyle>(
        _ title: LocalizedStringKey,
        values: [Value],
        selection: Binding<Value>,
        feedback: HapticFeedback? = .selection,
        format style: Style
    ) where Style.FormatInput == Value, Style.FormatOutput == String {
        self.init(title, values: values, selection: selection, feedback: feedback, label: { style.format($0) })
    }

    public var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                FlowLayout(spacing: Space.xs, lineSpacing: 0) { chips }
            } else {
                // One row while every title fits in full; otherwise two even rows, so "6.5" never truncates to "…".
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: Space.xs) { chips }
                    LazyVGrid(columns: twoRowColumns, spacing: Space.xs) { chips }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(title)
        .koboFeedback(feedback, trigger: selection.wrappedValue)
    }

    /// Equal columns for the chips in two rows: five columns for nine or ten values.
    private var twoRowColumns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: Space.xs), count: max(1, (items.count + 1) / 2))
    }

    private var chips: some View {
        ForEach(items) { item in
            let isSelected = item.value == selection.wrappedValue
            Button {
                selection.wrappedValue = item.value
            } label: {
                Text(verbatim: label(item.value))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(QuickPickItem<Value>.minimumScale)
            }
            .buttonStyle(ChipStyle(tone: .accent, isSelected: isSelected, fillsWidth: true))
            .accessibilityAddTraits(isSelected ? [.isSelected] : [])
        }
    }
}

/// One chip of a `QuickPickRow`, identified by its value.
private struct QuickPickItem<Value: Hashable & Sendable>: Identifiable {
    let value: Value
    var id: Value { value }

    /// How far a chip label may shrink before it truncates.
    static var minimumScale: CGFloat { 0.7 }
}

#if DEBUG
    private struct QuickPickGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var guests = 8
        @State private var price = 60.0

        var body: some View {
            VStack(alignment: .leading, spacing: Space.lg) {
                QuickPickRow("Guests", values: [5, 6, 7, 8, 9, 10, 11, 12], selection: $guests, format: .number)
                QuickPickRow(
                    "Price",
                    values: StepperField.nearbyValues(around: price, step: 2.5, in: 20...200),
                    selection: $price
                ) { $0.formatted(.number.precision(.fractionLength(0...1))) }
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Quick pick row") { QuickPickGallery() }
    #Preview("Quick pick row · dark, Amber") { QuickPickGallery().koboTheme(.amber).preferredColorScheme(.dark) }
    #Preview("Quick pick row · AX3") { QuickPickGallery().dynamicTypeSize(.accessibility3) }
#endif
