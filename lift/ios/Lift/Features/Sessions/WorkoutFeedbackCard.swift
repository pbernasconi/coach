import KoboComponents
import KoboTokens
import LiftSync
import SwiftUI

/// "How did it feel" on every done workout page: five faces for the feel, a 1–10 effort meter, and a note that opens
/// a small sheet. A tap saves at once; a second tap on the same face or effort clears it.
struct WorkoutFeedbackCard: View {
    @Environment(\.koboTheme) private var theme
    let feedback: WorkoutFeedback
    let save: WorkoutFeedbackSaveState
    let send: (WorkoutFeedbackAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            HStack(alignment: .firstTextBaseline) {
                Text("How did it feel")
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: Space.sm)
                WorkoutFeedbackStatus(save: save, fromWatch: feedback.fromWatch) { send(.retryTapped) }
            }
            WorkoutFaces(feedback: feedback) { send(.changed(.feel($0))) }
            Separator()
            WorkoutEffortMeter(feedback: feedback) { send(.changed(.rpe($0))) }
            Separator()
            commentRow
        }
        .koboCard()
    }

    private var commentRow: some View {
        Button { send(.commentTapped) } label: {
            HStack(alignment: .center, spacing: Space.sm) {
                Image(systemName: feedback.comment == nil ? "square.and.pencil" : "text.quote")
                    .foregroundStyle(theme.palette.textSecondary)
                    .accessibilityHidden(true)
                Group {
                    if let comment = feedback.comment {
                        Text(verbatim: comment)
                            .foregroundStyle(theme.palette.textPrimary)
                            .lineLimit(2)
                    } else {
                        Text("Add a note")
                            .foregroundStyle(theme.palette.textSecondary)
                    }
                }
                .font(theme.font(.subheadline))
                .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.right")
                    .font(theme.font(.footnote).weight(.semibold))
                    .foregroundStyle(theme.palette.textTertiary)
                    .accessibilityHidden(true)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.pressFeedback)
        .accessibilityLabel(Text("Note"))
        .accessibilityValue(feedback.comment.map { Text(verbatim: $0) } ?? Text("None"))
    }
}

/// "Saving…", "Saved", or "Not saved" with a retry; before the first edit, "From your watch" when Garmin's answers
/// filled it.
private struct WorkoutFeedbackStatus: View {
    @Environment(\.koboTheme) private var theme
    let save: WorkoutFeedbackSaveState
    let fromWatch: Bool
    let onRetry: () -> Void

    var body: some View {
        Group {
            switch save {
            case .idle:
                if fromWatch {
                    Label("From your watch", systemImage: "applewatch")
                        .foregroundStyle(theme.palette.textTertiary)
                }
            case .saving:
                Text("Saving…").foregroundStyle(theme.palette.textTertiary)
            case .saved:
                Label("Saved", systemImage: "checkmark")
                    .foregroundStyle(theme.palette.success.ink)
            case .failed:
                Button("Not saved · Try again", action: onRetry)
                    .foregroundStyle(theme.palette.danger.ink)
            }
        }
        .font(theme.font(.footnote))
        .transition(.opacity)
    }
}

/// The five faces, the logged one in colour and larger with its word under the row.
private struct WorkoutFaces: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let feedback: WorkoutFeedback
    let onTap: (Int) -> Void

    static let faces = ["😣", "😕", "😐", "🙂", "😄"]

    var body: some View {
        VStack(spacing: Space.xs) {
            HStack(spacing: 0) {
                ForEach(Array(Self.faces.enumerated()), id: \.offset) { index, face in
                    let value = index + 1
                    let isOn = feedback.feel == value
                    Button {
                        onTap(value)
                    } label: {
                        Text(verbatim: face)
                            .font(theme.font(.title))
                            .saturation(isOn || feedback.feel == nil ? 1 : 0)
                            .opacity(isOn || feedback.feel == nil ? 1 : 0.45)
                            .scaleEffect(isOn ? 1.2 : 1)
                            .frame(maxWidth: .infinity, minHeight: Size.minTouch)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.pressFeedback)
                    .accessibilityLabel(Text(verbatim: label(value)))
                    .accessibilityAddTraits(isOn ? .isSelected : [])
                }
            }
            .animation(Motion.fastSpatial.animation(reduceMotion: reduceMotion), value: feedback.feel)
            .koboFeedback(.selection, trigger: feedback.feel)
            Text(verbatim: feedback.feelLabel ?? String(localized: "Tap a face"))
                .font(theme.font(.footnote).weight(feedback.feel == nil ? .regular : .semibold))
                .foregroundStyle(feedback.feel == nil ? theme.palette.textTertiary : theme.palette.textPrimary)
                .accessibilityHidden(true)
        }
    }

    private func label(_ value: Int) -> String {
        feedback.feelLabels.indices.contains(value - 1) ? feedback.feelLabels[value - 1] : String(value)
    }
}

/// The perceived effort: ten steps that fill up to the logged one, calm blue to red, with its word and what it feels
/// like. VoiceOver adjusts it up and down.
private struct WorkoutEffortMeter: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var barHeight = Space.lg
    let feedback: WorkoutFeedback
    let onTap: (Int) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            HStack(alignment: .firstTextBaseline) {
                Text("Effort")
                    .font(theme.font(.subheadline).weight(.semibold))
                    .foregroundStyle(theme.palette.textPrimary)
                Spacer(minLength: Space.sm)
                if let step = feedback.rpeStep {
                    Text(verbatim: "\(step.value) · \(step.label)")
                        .font(theme.font(.subheadline).monospacedDigit())
                        .foregroundStyle(color(step.value))
                }
            }
            HStack(spacing: Space.xxs) {
                ForEach(1...10, id: \.self) { value in
                    Button {
                        onTap(value)
                    } label: {
                        RoundedRectangle(cornerRadius: Radius.xs, style: .continuous)
                            .fill(isFilled(value) ? color(value) : theme.palette.surfaceSunken)
                            .frame(height: barHeight)
                            .frame(maxWidth: .infinity, minHeight: Size.minTouch)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.pressFeedback)
                }
            }
            .koboFeedback(.selection, trigger: feedback.rpe)
            Text(verbatim: feedback.rpeStep?.detail ?? String(localized: "Tap from 1, very easy, to 10, max effort"))
                .font(theme.font(.footnote))
                .foregroundStyle(theme.palette.textTertiary)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text("Effort"))
        .accessibilityValue(effortValue)
        .accessibilityAdjustableAction { direction in
            let now = feedback.rpe ?? 0
            switch direction {
            case .increment: if now < 10 { onTap(now + 1) }
            case .decrement: if now > 1 { onTap(now - 1) }
            @unknown default: break
            }
        }
    }

    private var effortValue: Text {
        guard let step = feedback.rpeStep else { return Text("Not set") }
        return Text(verbatim: "\(step.value), \(step.label)")
    }

    private func isFilled(_ value: Int) -> Bool {
        guard let rpe = feedback.rpe else { return false }
        return value <= rpe
    }

    /// 1–3 easy, 4–5 moderate, 6–7 hard, 8–10 very hard.
    private func color(_ value: Int) -> Color {
        switch value {
        case ...3: theme.palette.info.ink
        case 4...5: theme.palette.success.ink
        case 6...7: theme.palette.warning.ink
        default: theme.palette.danger.ink
        }
    }
}
