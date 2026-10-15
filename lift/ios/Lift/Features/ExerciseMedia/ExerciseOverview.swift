import KoboComponents
import KoboTokens
import SwiftUI

/// Sizes of the exercise overview card.
enum ExerciseOverviewMetrics {
    /// The card's inner padding, every card's inset; the media tile's corners are concentric with it.
    static let padding = Space.cardInset
    /// The animation's side next to the facts.
    static let mediaSide: CGFloat = 148
    /// The animation's largest side above the facts, at accessibility text sizes.
    static let stackedMediaSide: CGFloat = 200
}

/// One card with the animation beside the exercise's facts (muscles, equipment). At accessibility text sizes the
/// animation sits above the facts, so no tag or label is squeezed or truncated.
struct ExerciseOverview<Media: View, Facts: View>: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private let media: Media
    private let facts: Facts

    init(@ViewBuilder media: () -> Media, @ViewBuilder facts: () -> Facts) {
        self.media = media()
        self.facts = facts()
    }

    var body: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: Space.lg) {
                    media
                        .frame(
                            maxWidth: ExerciseOverviewMetrics.stackedMediaSide,
                            maxHeight: ExerciseOverviewMetrics.stackedMediaSide
                        )
                        .frame(maxWidth: .infinity)
                    factsColumn
                }
            } else {
                HStack(alignment: .top, spacing: Space.lg) {
                    media
                        .frame(
                            width: ExerciseOverviewMetrics.mediaSide,
                            height: ExerciseOverviewMetrics.mediaSide
                        )
                    factsColumn
                }
            }
        }
        .koboCard(padding: ExerciseOverviewMetrics.padding)
    }

    private var factsColumn: some View {
        VStack(alignment: .leading, spacing: Space.md) { facts }
            .padding(.vertical, Space.xs)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A small label over its value in the overview: "Primary" over muscle tags, "Equipment" over a tag.
struct ExerciseFact<Value: View>: View {
    @Environment(\.koboTheme) private var theme
    private let title: LocalizedStringKey
    private let value: Value

    init(_ title: LocalizedStringKey, @ViewBuilder value: () -> Value) {
        self.title = title
        self.value = value()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Text(title)
                .font(theme.font(.caption).weight(.semibold))
                .foregroundStyle(theme.palette.textSecondary)
                .textCase(.uppercase)
            value
        }
        .accessibilityElement(children: .combine)
    }
}

/// Muscle names as tags that wrap onto more lines when they do not fit.
struct MuscleTags: View {
    let muscles: [String]
    let style: KoboTag.Style

    var body: some View {
        FlowLayout {
            // Fixed labels from the library or catalog; the offset is a stable identity for them.
            ForEach(Array(muscles.enumerated()), id: \.offset) { _, muscle in
                KoboTag(verbatim: muscle, tone: .accent, style: style)
            }
        }
    }
}

/// The exercise's name at the top of a detail screen, with an optional small kicker above it. Compact on purpose:
/// the screen's content starts right under it.
struct ExerciseTitle: View {
    @Environment(\.koboTheme) private var theme
    let name: String
    var kicker: String?

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            if let kicker {
                Text(verbatim: kicker)
                    .font(theme.font(.footnote).weight(.semibold))
                    .foregroundStyle(theme.palette.accentText)
                    .textCase(.uppercase)
            }
            Text(verbatim: name)
                .font(theme.font(.title2).weight(.bold))
                .foregroundStyle(theme.palette.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
