import KoboComponents
import KoboTokens
import SwiftUI

/// One of the coach's lists: a title, then a line per point with a coloured dot.
struct ReviewCoachSection: View {
    let section: ActivityReview.Coach.Section
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Text(verbatim: section.title)
                .font(theme.font(.caption).weight(.semibold))
                .foregroundStyle(theme.palette.textSecondary)
                .textCase(.uppercase)
            ForEach(Array(section.items.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                    Circle()
                        .fill(dot)
                        .frame(width: Space.xs + Space.xxs, height: Space.xs + Space.xxs)
                        .alignmentGuide(.firstTextBaseline) { $0[.bottom] }
                        .accessibilityHidden(true)
                    Text(verbatim: item)
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var dot: Color {
        switch section.key {
        case "well": theme.palette.success.ink
        case "improve": theme.palette.danger.ink
        default: theme.palette.textTertiary
        }
    }
}

/// A set of reps: how many hit, a chip per rep (its pace or power, bordered by how it went), and the set's numbers.
struct ReviewSetView: View {
    let set: ActivityReview.RepSet
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            HStack(alignment: .firstTextBaseline) {
                Text(verbatim: set.title)
                    .font(theme.font(.subheadline).weight(.semibold))
                    .foregroundStyle(theme.palette.textPrimary)
                Spacer(minLength: Space.sm)
                Text(verbatim: set.summary)
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textSecondary)
            }
            LazyVGrid(columns: [GridItem(.adaptive(minimum: Space.xxxl * 2), spacing: Space.xs)], spacing: Space.xs) {
                ForEach(Array(set.reps.enumerated()), id: \.offset) { index, rep in
                    VStack(spacing: Space.xxs) {
                        Text(verbatim: "\(index + 1)")
                            .font(theme.font(.caption))
                            .foregroundStyle(theme.palette.textTertiary)
                        Text(verbatim: rep.text)
                            .font(theme.font(.subheadline).monospacedDigit().weight(.semibold))
                            .foregroundStyle(theme.palette.textPrimary)
                        if let hr = rep.hrText {
                            Text(verbatim: hr)
                                .font(theme.font(.caption).monospacedDigit())
                                .foregroundStyle(theme.palette.textSecondary)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Space.xs)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.xs)
                            .strokeBorder(
                                ReviewColors.verdict(rep.verdict, palette: theme.palette),
                                lineWidth: Size.hairline * 3
                            )
                    )
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel(Text(verbatim: "\(rep.label): \(rep.text)"))
                }
            }
            ForEach(set.stats, id: \.label) { stat in
                HStack {
                    Text(verbatim: stat.label).foregroundStyle(theme.palette.textSecondary)
                    Spacer(minLength: Space.sm)
                    Text(verbatim: stat.value).foregroundStyle(theme.palette.textPrimary).monospacedDigit()
                }
                .font(theme.font(.footnote))
            }
        }
    }
}

/// One step: a dot coloured by how it went, its name, planned against done, heart rate and the verdict.
struct ReviewStepRow: View {
    let step: ActivityReview.Step
    @Environment(\.koboTheme) private var theme

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
            Circle()
                .fill(ReviewColors.verdict(step.verdict, palette: theme.palette))
                .frame(width: Space.sm, height: Space.sm)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Space.xxs) {
                HStack(alignment: .firstTextBaseline) {
                    Text(verbatim: step.label)
                        .font(theme.font(.subheadline).weight(.medium))
                        .foregroundStyle(theme.palette.textPrimary)
                    Spacer(minLength: Space.sm)
                    Text(verbatim: step.verdictLabel)
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textSecondary)
                }
                Text(verbatim: String(localized: "Plan \(step.plannedText)"))
                    .font(theme.font(.footnote).monospacedDigit())
                    .foregroundStyle(theme.palette.textSecondary)
                Text(verbatim: [step.doneText, step.hrText == "–" ? nil : "HR \(step.hrText)", step.inTargetText]
                    .compactMap { $0 }.joined(separator: " · "))
                    .font(theme.font(.footnote).monospacedDigit())
                    .foregroundStyle(theme.palette.textPrimary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// The review's colours, as the plan calendar's: on target green, close amber, off red, not done grey.
nonisolated enum ReviewColors {
    @MainActor static func verdict(_ verdict: String, palette: Palette) -> Color {
        switch verdict {
        case "hit": palette.success.ink
        case "close": palette.warning.ink
        case "missed": palette.neutral.ink
        default: palette.danger.ink
        }
    }

    static func levelTone(_ level: String) -> Tone {
        switch level {
        case "good": .success
        case "partial": .warning
        default: .danger
        }
    }

    static func ratingTone(_ rating: String?) -> Tone {
        switch rating {
        case "nailed", "solid": .success
        case "mixed": .warning
        default: .danger
        }
    }
}
