import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// One exercise in a reply: its picture, the muscles it works, the sets planned (else the last ones), the best set,
/// and how to do it in a few steps. The header opens the exercise page with its history.
struct CoachExerciseCard: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var side = Size.thumbnail + Space.xxl
    let exercise: CoachExerciseData
    let media: MediaImage?
    let onOpen: (() -> Void)?

    var body: some View {
        ChatEmbedCard(verbatim: exercise.name, subtitle: muscles, systemImage: "dumbbell.fill", action: onOpen) {
            if let item = exercise.item {
                HStack(alignment: .top, spacing: Space.md) {
                    picture
                    VStack(alignment: .leading, spacing: Space.xs) {
                        Text(verbatim: item.setsText)
                            .font(theme.font(.body).weight(.semibold))
                            .foregroundStyle(theme.palette.textPrimary)
                        if let load = item.loadNote { line(load) }
                        if let last = item.lastTime { line("Last: \(last.sets.joined(separator: ", "))") }
                        if let best = item.best { line("Best: \(best.text)") }
                    }
                    .fixedSize(horizontal: false, vertical: true)
                }
                if !item.steps.isEmpty {
                    VStack(alignment: .leading, spacing: Space.xs) {
                        ForEach(Array(item.steps.prefix(4).enumerated()), id: \.offset) { index, step in
                            HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                                Text(verbatim: "\(index + 1).").monospacedDigit()
                                    .foregroundStyle(theme.palette.textTertiary)
                                Text(verbatim: step).foregroundStyle(theme.palette.textSecondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .font(theme.font(.subheadline))
                        }
                    }
                }
            }
        }
    }

    private var muscles: String? {
        guard let item = exercise.item, !item.muscles.isEmpty else { return nil }
        return (item.muscles + item.secondaryMuscles.prefix(2)).joined(separator: " · ")
    }

    private func line(_ text: String) -> some View {
        Text(verbatim: text)
            .font(theme.font(.subheadline))
            .foregroundStyle(theme.palette.textSecondary)
    }

    @ViewBuilder private var picture: some View {
        Group {
            if let media {
                ExerciseThumbnail(image: media, name: exercise.name, side: side)
            } else {
                Image(systemName: "dumbbell.fill")
                    .foregroundStyle(theme.palette.textTertiary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(theme.palette.surfaceSunken)
            }
        }
        .frame(width: side, height: side)
        .clipShape(RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
        .accessibilityHidden(true)
    }
}

/// Readiness in a reply: the Today chips (readiness, sleep, HRV, fitness, form) each with its tone, the day's cue,
/// and form over the last six weeks.
struct CoachReadinessCard: View {
    @Environment(\.koboTheme) private var theme
    let readiness: CoachReadinessData
    let onOpen: () -> Void

    var body: some View {
        ChatEmbedCard(verbatim: String(localized: "Readiness"), subtitle: readiness.cue, systemImage: "heart.text.square",
                      action: onOpen) {
            if let chips = readiness.header?.chips, !chips.isEmpty {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: Size.thumbnail * 1.6), spacing: Space.sm)],
                          alignment: .leading, spacing: Space.sm) {
                    ForEach(chips) { CoachReadinessChip(chip: $0) }
                }
            }
            if let form = formValues, form.count > 1 {
                VStack(alignment: .leading, spacing: Space.xxs) {
                    Text("Form, last 6 weeks")
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.palette.textTertiary)
                    Sparkline(values: form, reference: 0, verbatimAccessibilityLabel: String(localized: "Form, last 6 weeks"))
                        .frame(height: Space.xxxl + Space.lg)
                }
            }
        }
    }

    /// Form (TSB) for the last 42 days that happened, oldest first.
    private var formValues: [Double]? {
        readiness.fitness.map { Array($0.days.filter { !$0.projected }.suffix(42).map(\.tsb)) }
    }
}

/// One chip: the label, then the value in its tone's ink with the tone's glyph, so it never reads by colour alone.
private struct CoachReadinessChip: View {
    @Environment(\.koboTheme) private var theme
    let chip: TodayChip

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            Text(verbatim: chip.label)
                .font(theme.font(.caption))
                .foregroundStyle(theme.palette.textSecondary)
            Text(verbatim: chip.valueText)
                .font(theme.font(.headline).monospacedDigit())
                .foregroundStyle(chip.tone == .neutral ? theme.palette.textPrimary : theme.palette.status(chip.tone.kobo).ink)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Space.sm)
        .background(theme.palette.surfaceSunken.opacity(0.5), in: RoundedRectangle(cornerRadius: Radius.sm))
        .accessibilityElement(children: .combine)
    }
}
