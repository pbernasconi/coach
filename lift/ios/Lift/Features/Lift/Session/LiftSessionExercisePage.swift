import KoboComponents
import KoboTokens
import SwiftUI

/// One exercise in full, pushed over the session: the picture, name and what it works, the result (top set, e1RM and
/// the change against last time, with the trend), every set with its target, RPE and note, then last time, the best
/// e1RM (to the exercise's history) and how to do it.
struct LiftSessionExercisePage: View {
    let state: LiftSessionState
    let exerciseID: String
    let send: (LiftSessionAction) -> Void

    var body: some View {
        ScrollView {
            if let exercise {
                VStack(alignment: .leading, spacing: Space.section) {
                    LiftExerciseHeader(exercise: exercise, media: state.media[exercise.id])
                    if let result = exercise.result, result.state == "done" {
                        LiftExerciseResultCard(result: result, name: exercise.name)
                    }
                    VStack(alignment: .leading, spacing: Space.sm) {
                        SectionHeader("Sets")
                        LiftSessionSetList(exercise: exercise)
                    }
                    LiftSessionExerciseExtras(
                        exercise: exercise,
                        isStepsExpanded: state.expandedSteps.contains(exercise.id),
                        send: send
                    )
                }
                .pageColumn()
                .padding(.top, Space.sm)
                .padding(.bottom, Space.xxl)
            }
        }
        .screenCanvas()
        .workoutBarTitle(exercise?.name, after: Space.xxl)
    }

    private var exercise: LiftSessionExercise? {
        state.detail.content.value?.exercises.value?.items.first { $0.id == exerciseID }
    }
}

/// The picture, the name, and what it works ("Quads, Glutes · also Hamstrings · Barbell · 3:00 rest").
private struct LiftExerciseHeader: View {
    @Environment(\.koboTheme) private var theme
    let exercise: LiftSessionExercise
    let media: MediaImage?

    var body: some View {
        HStack(alignment: .top, spacing: Space.md) {
            if let media {
                ExerciseThumbnail(image: media, name: exercise.name)
            }
            VStack(alignment: .leading, spacing: Space.xs) {
                Text(verbatim: exercise.name)
                    .font(theme.font(.title2).weight(.semibold))
                    .foregroundStyle(theme.palette.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                if !facts.isEmpty {
                    Text(verbatim: facts.joined(separator: " · "))
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// "Quads, Glutes · also Hamstrings, Core · Barbell · Load each side · 3:00 rest", from what the server sent.
    private var facts: [String] {
        var parts: [String] = []
        if !exercise.muscles.isEmpty { parts.append(exercise.muscles.joined(separator: ", ")) }
        if !exercise.secondaryMuscles.isEmpty {
            parts.append(String(localized: "also \(exercise.secondaryMuscles.joined(separator: ", "))"))
        }
        parts += [exercise.equipment, exercise.loadNote, exercise.restText].compactMap(\.self)
        return parts
    }
}

/// The result on one card: the top set, the e1RM, the change against last time, and the e1RM of the last sessions.
private struct LiftExerciseResultCard: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var chartHeight = Size.thumbnail
    let result: LiftExerciseResult
    let name: String

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            WorkoutStatGrid(items: cells, id: \.label) { cell in
                WorkoutStatCell(label: cell.label, value: cell.valueText, unit: cell.unit)
            }
            if let change = result.change {
                Label {
                    Text(verbatim: "\(change.text) e1RM \(change.caption)")
                } icon: {
                    Image(systemName: LiftChangeTone.symbol(change.tone)).accessibilityHidden(true)
                }
                .font(theme.font(.subheadline).weight(.semibold))
                .foregroundStyle(LiftChangeTone.color(change.tone, palette: theme.palette))
            }
            if let progress = result.progress {
                VStack(alignment: .leading, spacing: Space.xxs) {
                    Sparkline(values: progress.values, color: theme.palette.info.ink, verbatimAccessibilityLabel: "\(name), \(progress.caption)")
                        .frame(height: chartHeight)
                    Text(verbatim: progress.caption)
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.palette.textTertiary)
                }
            }
        }
        .koboCard()
    }

    private var cells: [ActivityOverview.Stat] {
        [
            result.topSetText.map { ActivityOverview.Stat(label: String(localized: "Top set"), valueText: $0) },
            result.e1rmText.map { text in
                let parts = text.split(separator: " ", maxSplits: 1).map(String.init)
                return ActivityOverview.Stat(label: "e1RM", valueText: parts[0], unit: parts.count > 1 ? parts[1] : nil)
            },
        ].compactMap(\.self)
    }
}

/// The note, then every set in order, warm-ups first.
private struct LiftSessionSetList: View {
    @Environment(\.koboTheme) private var theme
    let exercise: LiftSessionExercise

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            if let note = exercise.note {
                Label {
                    Text(verbatim: note).fixedSize(horizontal: false, vertical: true)
                } icon: {
                    Image(systemName: "quote.bubble").accessibilityHidden(true)
                }
                .font(theme.font(.footnote))
                .foregroundStyle(theme.palette.textSecondary)
            }
            VStack(spacing: 0) {
                ForEach(Array(exercise.sets.enumerated()), id: \.element.id) { index, set in
                    LiftSessionSetRow(item: set, isFirst: index == 0)
                }
            }
        }
        .koboCard()
    }
}

/// One set: its label, the load × reps (struck through when skipped), the target under a done set, an arrow when it
/// beat the target, its RPE and note. Warm-ups are quieter.
private struct LiftSessionSetRow: View {
    @Environment(\.koboTheme) private var theme
    let item: LiftSessionSet
    var isFirst = false

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.md) {
            Text(verbatim: item.label)
                .font(theme.font(.footnote).weight(.semibold))
                .foregroundStyle(labelColor)
                .frame(minWidth: Size.thumbnail, alignment: .leading)
            VStack(alignment: .leading, spacing: Space.xxs) {
                HStack(alignment: .firstTextBaseline, spacing: Space.xs) {
                    Text(verbatim: item.text)
                        .font(theme.font(.body).monospacedDigit())
                        .strikethrough(isSkipped)
                        .foregroundStyle(valueColor)
                    if item.beatTarget {
                        Image(systemName: "arrow.up")
                            .font(theme.font(.footnote).weight(.bold))
                            .foregroundStyle(theme.palette.success.ink)
                            .accessibilityLabel(Text("Above target"))
                    }
                }
                if !details.isEmpty {
                    Text(verbatim: details.joined(separator: "\n"))
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.palette.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            statusSymbol
        }
        .padding(.vertical, Space.sm)
        .overlay(alignment: .top) { if !isFirst { Separator() } }
        .accessibilityElement(children: .combine)
    }

    private var isSkipped: Bool { item.status == "skipped" }
    private var isWarmUp: Bool { item.isWarmUp }

    /// The target, RPE and note lines under the value.
    private var details: [String] {
        [item.targetText, item.rpeText, item.note].compactMap(\.self)
    }

    private var labelColor: Color { isWarmUp ? theme.palette.textTertiary : theme.palette.textSecondary }

    private var valueColor: Color {
        if isSkipped || isWarmUp { return theme.palette.textTertiary }
        return item.status == "done" ? theme.palette.textPrimary : theme.palette.textSecondary
    }

    @ViewBuilder private var statusSymbol: some View {
        switch item.status {
        case "done":
            Image(systemName: "checkmark")
                .foregroundStyle(isWarmUp ? theme.palette.textTertiary : theme.palette.accentText)
                .accessibilityLabel(Text("Logged"))
        case "skipped":
            Image(systemName: "forward.fill")
                .foregroundStyle(theme.palette.textTertiary)
                .accessibilityLabel(Text("Skipped"))
        default:
            Image(systemName: "circle")
                .foregroundStyle(theme.palette.textTertiary)
                .accessibilityLabel(Text("Planned"))
        }
    }
}
