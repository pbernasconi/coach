import KoboComponents
import KoboTokens
import SwiftUI

/// One number of a workout page: its label small above, the value large with its unit small after it. The same on
/// the activity, planned workout and Lift session pages.
struct WorkoutStatCell: View {
    enum Size { case regular, compact }

    let label: String
    let value: String
    var unit: String?
    var size: Size = .regular
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            Text(verbatim: label)
                .font(theme.font(size == .regular ? .subheadline : .caption))
                .foregroundStyle(theme.palette.textSecondary)
                .lineLimit(1)
            HStack(alignment: .firstTextBaseline, spacing: Space.xxs) {
                Text(verbatim: value)
                    .font(theme.font(size == .regular ? .title2 : .headline).weight(.semibold).monospacedDigit())
                    .foregroundStyle(theme.palette.textPrimary)
                if let unit {
                    Text(verbatim: unit)
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .lineLimit(1)
            .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// Numbers two to a row (one at accessibility sizes), for a card.
struct WorkoutStatGrid<Item, Cell: View>: View {
    let items: [Item]
    let id: KeyPath<Item, String>
    @ViewBuilder let cell: (Item) -> Cell
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let count = typeSize.isAccessibilitySize ? 1 : 2
        LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: Space.md, alignment: .topLeading), count: count),
            alignment: .leading,
            spacing: Space.lg
        ) {
            ForEach(items, id: id) { cell($0) }
        }
    }
}
