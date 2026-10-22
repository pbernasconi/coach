import KoboComponents
import KoboTokens
import SwiftUI

/// Every exercise of the session on one card, one row each: the picture, the name (a trophy for a record) and its e1RM,
/// the change against last time over the e1RM trend, then a chip per working set. A row opens the exercise's page.
struct LiftSessionExerciseRows: View {
    let exercises: [LiftSessionExercise]
    let media: [String: MediaImage]
    let send: (LiftSessionAction) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(exercises.enumerated()), id: \.element.id) { index, exercise in
                if index > 0 { Separator().padding(.leading, Size.iconLg * 2 + Space.md) }
                LiftSessionExerciseRow(exercise: exercise, media: media[exercise.id]) {
                    send(.exerciseOpened(exerciseID: exercise.id))
                }
                .onAppear { if exercise.media?.image != nil { send(.mediaNeeded(exerciseID: exercise.id)) } }
            }
        }
        .padding(.vertical, Space.xs)
        .koboCard(padding: 0)
    }
}

private struct LiftSessionExerciseRow: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var typeSize
    @ScaledMetric(relativeTo: .body) private var thumb = Size.iconLg * 2
    let exercise: LiftSessionExercise
    let media: MediaImage?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: Space.md) {
                picture
                VStack(alignment: .leading, spacing: Space.xs) {
                    HStack(alignment: .top, spacing: Space.sm) {
                        title
                        if !typeSize.isAccessibilitySize, let result = exercise.result {
                            LiftResultTrend(result: result, name: exercise.name)
                        }
                    }
                    if exercise.sets.contains(where: { !$0.isWarmUp }) {
                        LiftSetChips(sets: exercise.sets, topSetText: exercise.result?.topSetText)
                    } else {
                        Text(verbatim: summary)
                            .font(theme.font(.subheadline).monospacedDigit())
                            .foregroundStyle(theme.palette.textSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.right")
                    .font(theme.font(.footnote).weight(.semibold))
                    .foregroundStyle(theme.palette.textTertiary)
                    .accessibilityHidden(true)
                    .frame(maxHeight: thumb)
            }
            .padding(.horizontal, Space.md)
            .padding(.vertical, Space.sm)
            .contentShape(Rectangle())
        }
        .buttonStyle(.pressFeedback)
        .accessibilityElement(children: .combine)
        .accessibilityHint(Text("Opens the exercise"))
    }

    /// The name (a trophy for a record) over "e1RM 144 kg · 1 warm-up".
    private var title: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            HStack(alignment: .firstTextBaseline, spacing: Space.xs) {
                Text(verbatim: exercise.name)
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                    .lineLimit(2)
                if exercise.result?.record == true {
                    Image(systemName: "trophy.fill")
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.warning.ink)
                        .accessibilityLabel(Text("Record"))
                }
            }
            if let line = detailLine {
                Text(verbatim: line)
                    .font(theme.font(.footnote).monospacedDigit())
                    .foregroundStyle(theme.palette.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder private var picture: some View {
        Group {
            if let media {
                ExerciseThumbnail(image: media, name: exercise.name, side: thumb)
            } else {
                Image(systemName: "dumbbell.fill")
                    .foregroundStyle(theme.palette.textTertiary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(theme.palette.surfaceSunken)
            }
        }
        .frame(width: thumb, height: thumb)
        .clipShape(RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
        .accessibilityHidden(true)
    }

    /// "e1RM 144 kg · 1 warm-up", or "Skipped", or nil.
    private var detailLine: String? {
        if exercise.result?.state == "skipped" { return String(localized: "Skipped") }
        let warmUps = exercise.sets.filter(\.isWarmUp).count
        let parts = [
            exercise.result?.e1rmText.map { String(localized: "e1RM \($0)") },
            warmUps > 0 ? String(localized: "\(warmUps) warm-up") : nil,
        ].compactMap(\.self)
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// The server's result line; an older server: the sets count.
    private var summary: String { exercise.result?.summaryText ?? exercise.setsText }
}

/// The change against last time ("+13 lb", green up, red down) with the e1RM trend under it.
struct LiftResultTrend: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .caption) private var sparkWidth = Size.thumbnail
    @ScaledMetric(relativeTo: .caption) private var sparkHeight = Size.iconMd
    let result: LiftExerciseResult
    let name: String

    var body: some View {
        VStack(alignment: .trailing, spacing: Space.xxs) {
            if let change = result.change {
                Label {
                    Text(verbatim: change.text).monospacedDigit()
                } icon: {
                    Image(systemName: LiftChangeTone.symbol(change.tone)).accessibilityHidden(true)
                }
                .labelStyle(.titleAndIcon)
                .font(theme.font(.footnote).weight(.semibold))
                .foregroundStyle(LiftChangeTone.color(change.tone, palette: theme.palette))
                .accessibilityLabel(Text(verbatim: "\(change.text) \(change.caption)"))
            }
            if let progress = result.progress {
                Sparkline(values: progress.values, color: theme.palette.info.ink, verbatimAccessibilityLabel: "\(name), \(progress.caption)")
                    .frame(width: sparkWidth, height: sparkHeight)
            }
        }
        .padding(.bottom, Space.xs)
        .fixedSize()
    }
}

/// How a change against last time looks: up green, down red, the same quiet.
@MainActor
enum LiftChangeTone {
    static func symbol(_ tone: String) -> String {
        switch tone {
        case "up": "arrow.up.right"
        case "down": "arrow.down.right"
        default: "equal"
        }
    }

    static func color(_ tone: String, palette: Palette) -> Color {
        switch tone {
        case "up": palette.success.ink
        case "down": palette.danger.ink
        default: palette.textSecondary
        }
    }
}
