import KoboComponents
import KoboTokens
import SwiftUI

/// The workout review, under the headline numbers: the score and its word, a strip of the steps coloured by how each
/// went, the coach's words (what it did, went well, to improve, next time), the hard reps of each set, and every step
/// one tap away. While Claude writes the words the card says so; the page asks for them on its own.
struct ActivityReviewCard: View {
    let review: ActivityReview
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showsSteps = false

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            SectionHeader("Workout review")
            VStack(alignment: .leading, spacing: Space.lg) {
                scoreRow
                ReviewStepStrip(steps: review.steps)
                coach
                ForEach(Array(review.sets.enumerated()), id: \.offset) { _, set in
                    ReviewSetView(set: set)
                }
                if !review.flags.isEmpty { flags }
                stepsDisclosure
            }
            .koboCard()
        }
    }

    private var scoreRow: some View {
        HStack(spacing: Space.md) {
            ProgressRing(
                progress: Double(review.score) / 100,
                lineWidth: Space.xs + Space.xxs,
                tone: ReviewColors.levelTone(review.level),
                verbatimAccessibilityLabel: review.scoreWord
            ) {
                Text(verbatim: "\(review.score)")
                    .font(theme.font(.headline).monospacedDigit())
                    .foregroundStyle(theme.palette.textPrimary)
            }
            .frame(width: Size.thumbnail, height: Size.thumbnail)
            VStack(alignment: .leading, spacing: Space.xxs) {
                Text(verbatim: review.scoreWord)
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                if let name = review.workoutName {
                    Text(verbatim: name)
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                }
                Text(verbatim: [review.alignedText, review.extraText].compactMap { $0 }.joined(separator: " · "))
                    .font(theme.font(.caption))
                    .foregroundStyle(theme.palette.textTertiary)
            }
            Spacer(minLength: 0)
        }
    }

    @ViewBuilder private var coach: some View {
        let ai = review.ai
        if ai.status == "pending" {
            HStack(spacing: Space.sm) {
                ProgressView().controlSize(.small)
                Text("Coach is reviewing this workout…")
                    .font(theme.font(.subheadline))
                    .foregroundStyle(theme.palette.textSecondary)
            }
        } else if let headline = ai.headline {
            VStack(alignment: .leading, spacing: Space.md) {
                VStack(alignment: .leading, spacing: Space.xs) {
                    if let label = ai.ratingLabel {
                        StatusPill(verbatim: label, tone: ReviewColors.ratingTone(ai.rating))
                    }
                    Text(verbatim: headline)
                        .font(theme.font(.body).weight(.semibold))
                        .foregroundStyle(theme.palette.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                ForEach(ai.sections, id: \.key) { section in
                    ReviewCoachSection(section: section)
                }
            }
        }
        if let note = ai.note {
            Text(verbatim: note)
                .font(theme.font(.footnote))
                .foregroundStyle(theme.palette.textTertiary)
        }
    }

    private var flags: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            ForEach(Array(review.flags.enumerated()), id: \.offset) { _, flag in
                Label {
                    Text(verbatim: flag).fixedSize(horizontal: false, vertical: true)
                } icon: {
                    Image(systemName: "info.circle").foregroundStyle(theme.palette.textTertiary)
                }
                .font(theme.font(.footnote))
                .foregroundStyle(theme.palette.textSecondary)
            }
        }
    }

    private var stepsDisclosure: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            Separator()
            Button {
                withAnimation(Motion.state.animation(reduceMotion: reduceMotion)) { showsSteps.toggle() }
            } label: {
                HStack(spacing: Space.sm) {
                    Text("Every step").foregroundStyle(theme.palette.textPrimary)
                    Spacer(minLength: Space.sm)
                    Text(verbatim: "\(review.steps.count)").foregroundStyle(theme.palette.textSecondary)
                    Image(systemName: showsSteps ? "chevron.up" : "chevron.down")
                        .font(theme.font(.footnote).weight(.semibold))
                        .foregroundStyle(theme.palette.textTertiary)
                        .accessibilityHidden(true)
                }
                .font(theme.font(.body))
                .frame(maxWidth: .infinity, minHeight: Size.minTouch, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if showsSteps {
                VStack(alignment: .leading, spacing: Space.sm) {
                    ForEach(review.steps, id: \.index) { step in ReviewStepRow(step: step) }
                }
            }
        }
    }
}

/// Every step side by side, as wide as planned and as tall as its zone, coloured by how it went. Easy steps inside a
/// repeat are faded, so the reps stand out.
struct ReviewStepStrip: View {
    let steps: [ActivityReview.Step]
    @Environment(\.koboTheme) private var theme

    var body: some View {
        let total = max(steps.reduce(0.0) { $0 + max($1.plannedSeconds ?? $1.doneSeconds, 1) }, 1)
        GeometryReader { proxy in
            let gap: CGFloat = Size.hairline * 2
            let width = proxy.size.width - gap * CGFloat(max(steps.count - 1, 0))
            HStack(alignment: .bottom, spacing: gap) {
                ForEach(steps, id: \.index) { step in
                    let share = max(step.plannedSeconds ?? step.doneSeconds, 1) / total
                    let level = PlannedZone.level(step.zone ?? "Z1")
                    RoundedRectangle(cornerRadius: Size.hairline * 2)
                        .fill(ReviewColors.verdict(step.verdict, palette: theme.palette))
                        .opacity(step.inRepeat && step.kind != "work" ? 0.45 : 1)
                        .frame(
                            width: max(width * share, 1),
                            height: proxy.size.height * (0.3 + 0.175 * CGFloat(level))
                        )
                }
            }
            .frame(maxHeight: .infinity, alignment: .bottom)
        }
        .frame(height: Space.xxxl + Space.sm)
        .accessibilityElement()
        .accessibilityLabel(Text(verbatim: steps.map { "\($0.label): \($0.verdictLabel)" }.joined(separator: ", ")))
    }
}
