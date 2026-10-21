import KoboComponents
import KoboTokens
import SwiftUI

/// One exercise of the session on a card: its picture, number, name and sets count (a check once every working set is
/// logged), what it works, its note, the set tiles, then last time, the best e1RM and how to do it.
struct LiftSessionExerciseCard: View {
    @Environment(\.koboTheme) private var theme
    let exercise: LiftSessionExercise
    /// The catalog picture; nil when the exercise has none.
    let media: MediaImage?
    let isStepsExpanded: Bool
    let send: (LiftSessionAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            header
            if !facts.isEmpty {
                Text(verbatim: facts.joined(separator: " · "))
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
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
                ForEach(exercise.sets) { set in
                    LiftSessionSetRow(item: set)
                }
            }
            LiftSessionExerciseExtras(exercise: exercise, isStepsExpanded: isStepsExpanded, send: send)
        }
        .koboCard()
        .onAppear { if exercise.media?.image != nil { send(.mediaNeeded(exerciseID: exercise.id)) } }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: Space.md) {
            if let media {
                ExerciseThumbnail(image: media, name: exercise.name)
            }
            VStack(alignment: .leading, spacing: Space.xxs) {
                Text(verbatim: exercise.indexText)
                    .font(theme.font(.caption).weight(.semibold))
                    .foregroundStyle(theme.palette.textTertiary)
                Text(verbatim: exercise.name)
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                Label {
                    Text(verbatim: exercise.setsText).monospacedDigit()
                } icon: {
                    Image(systemName: exercise.complete ? "checkmark.circle.fill" : "circle.dashed")
                        .foregroundStyle(exercise.complete ? theme.palette.success.ink : theme.palette.textTertiary)
                        .accessibilityHidden(true)
                }
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textSecondary)
                .accessibilityValue(exercise.complete ? Text("Complete") : Text(verbatim: ""))
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

/// One set: its label, the load × reps (struck through when skipped), the target under a done set, an arrow when it
/// beat the target, its RPE and note. Warm-ups are quieter.
private struct LiftSessionSetRow: View {
    @Environment(\.koboTheme) private var theme
    let item: LiftSessionSet

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
        .overlay(alignment: .top) { Separator() }
        .accessibilityElement(children: .combine)
    }

    private var isSkipped: Bool { item.status == "skipped" }
    private var isWarmUp: Bool { item.kind == "warmup" }

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
