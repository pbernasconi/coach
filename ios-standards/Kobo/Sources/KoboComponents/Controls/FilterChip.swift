import KoboTokens
import SwiftUI

/// One facet of a `FilterBar`: a chip that names its filter while nothing is chosen, with a chevron because a tap opens
/// the facet's picker. With values chosen it fills, shows them as "Vegan +1" (`FilterChipLabel`) and carries a ✕ that
/// clears them. VoiceOver reads the filter's name, then the chosen values.
///
///     FilterChip("Diet", selection: chosenDiets.map(\.title), onClear: { diets = [] }) { picking = .diet }
public struct FilterChip: View {
    private let name: Text
    private let selection: [String]
    private let onClear: () -> Void
    private let action: () -> Void

    /// - Parameters:
    ///   - selection: the chosen values' titles, in the order the picker lists them.
    ///   - onClear: clears this facet; shown as the ✕ while something is chosen.
    ///   - action: opens the facet's picker.
    public init(
        _ name: LocalizedStringKey,
        selection: [String],
        onClear: @escaping () -> Void,
        action: @escaping () -> Void
    ) {
        self.init(name: Text(name), selection: selection, onClear: onClear, action: action)
    }

    /// A chip whose filter name is shown as is.
    public init(
        verbatim name: String,
        selection: [String],
        onClear: @escaping () -> Void,
        action: @escaping () -> Void
    ) {
        self.init(name: Text(verbatim: name), selection: selection, onClear: onClear, action: action)
    }

    init(name: Text, selection: [String], onClear: @escaping () -> Void, action: @escaping () -> Void) {
        self.name = name
        self.selection = selection
        self.onClear = onClear
        self.action = action
    }

    public var body: some View {
        let summary = FilterChipLabel.summary(selection)
        Chip(
            title: summary.map { Text(verbatim: $0) } ?? name,
            systemImage: nil,
            trailingSystemImage: "chevron.down",
            tone: .accent,
            isSelected: summary != nil,
            onClear: onClear,
            action: action
        )
        .accessibilityLabel(name)
        .accessibilityValue(Text(verbatim: selection.joined(separator: ", ")))
    }
}

#if DEBUG
    private struct FilterChipGallery: View {
        @Environment(\.koboTheme) private var theme
        @State private var diets = ["Vegan", "Halal"]

        var body: some View {
            VStack(alignment: .leading, spacing: Space.sm) {
                HStack(spacing: Space.sm) {
                    FilterChip("Diet", selection: diets, onClear: { diets = [] }) {
                        diets = ["Vegan", "Halal"]
                    }
                    FilterChip("Cuisine", selection: [], onClear: {}) {}
                }
                FilterChip(verbatim: "Course", selection: ["Dessert"], onClear: {}) {}
            }
            .padding(Space.gutter)
            .background(theme.palette.canvas)
        }
    }

    #Preview("Filter chip") { FilterChipGallery() }
    #Preview("Filter chip · dark, Amber") {
        FilterChipGallery().koboTheme(.amber).preferredColorScheme(.dark)
    }
    #Preview("Filter chip · AX3") { FilterChipGallery().dynamicTypeSize(.accessibility3) }
#endif
