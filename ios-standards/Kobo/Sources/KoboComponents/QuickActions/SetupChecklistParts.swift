import KoboTokens
import SwiftUI

/// The title, the "1 of 3" count and the optional "…" menu of a `SetupChecklistCard`.
struct SetupChecklistHeader: View {
    @Environment(\.koboTheme) private var theme
    let title: Text
    let done: Int
    let count: Int
    let onHide: (() -> Void)?

    var body: some View {
        HStack(spacing: Space.sm) {
            title
                .font(theme.font(.headline))
                .foregroundStyle(theme.palette.textPrimary)
                .accessibilityAddTraits(.isHeader)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("\(done) of \(count)", bundle: .module)
                .font(theme.font(.footnote))
                .foregroundStyle(theme.palette.textSecondary)
                .monospacedDigit()
                .contentTransition(.numericText(value: Double(done)))
                .accessibilityHidden(true)
            if let onHide {
                Menu {
                    Button(action: onHide) { Text("Hide", bundle: .module) }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(theme.font(.body).weight(.semibold))
                        .foregroundStyle(theme.palette.textSecondary)
                        .frame(width: Size.minTouch, height: Size.minTouch)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel(Text("More options", bundle: .module))
            }
        }
    }
}

/// One segment per counted step, the done ones first in the accent fill; a newly done segment fills from its leading
/// edge.
struct SetupChecklistBar: View {
    @Environment(\.koboTheme) private var theme
    let fills: [Bool]

    var body: some View {
        HStack(spacing: Space.xs) {
            ForEach(Array(fills.enumerated()), id: \.offset) { _, isFilled in
                ZStack(alignment: .leading) {
                    Capsule().fill(theme.palette.surfaceSunken)
                    Capsule().fill(theme.palette.accent).scaleEffect(x: isFilled ? 1 : 0, anchor: .leading)
                }
                .frame(height: Space.xs)
            }
        }
    }
}

/// One step: the mark, the title and caption, and a chevron while it is open. An open step is a button.
struct SetupChecklistRow: View {
    @Environment(\.koboTheme) private var theme
    let step: SetupChecklistStep
    let action: () -> Void

    var body: some View {
        if step.isDone {
            content.accessibilityElement(children: .combine)
        } else {
            Button(action: action) { content }
                .buttonStyle(.pressFeedback(.highlight))
        }
    }

    private var content: some View {
        HStack(spacing: Space.md) {
            SetupChecklistMark(isDone: step.isDone)
            VStack(alignment: .leading, spacing: Space.xxs) {
                Text(verbatim: step.title)
                    .font(theme.font(.subheadline).weight(.semibold))
                    .foregroundStyle(theme.palette.textPrimary)
                if let caption = step.caption {
                    Text(verbatim: caption)
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if !step.isDone {
                Image(systemName: "chevron.right")
                    .font(theme.font(.footnote).weight(.semibold))
                    .foregroundStyle(theme.palette.textTertiary)
                    .accessibilityHidden(true)
            }
        }
        .padding(.vertical, Space.sm)
        .frame(minHeight: Size.minTouch)
        .contentShape(Rectangle())
        .accessibilityValue(step.isDone ? Text("Done", bundle: .module) : Text("Not done", bundle: .module))
    }
}

/// The step mark: a ring while open, an accent disc with a check when done. The check pops in (`Motion.pop`).
struct SetupChecklistMark: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .body) private var side = Size.iconLg

    var isDone: Bool

    var body: some View {
        ZStack {
            Circle()
                .strokeBorder(theme.palette.textTertiary, lineWidth: Space.xxs)
                .opacity(isDone ? 0 : 1)
            Circle().fill(theme.palette.accent).opacity(isDone ? 1 : 0)
            if isDone {
                Image(systemName: "checkmark")
                    .font(theme.font(.caption).weight(.bold))
                    .foregroundStyle(theme.palette.onAccent)
                    .transition(Motion.pop(reduceMotion: reduceMotion))
            }
        }
        .frame(width: side, height: side)
        .koboAnimation(.state, value: isDone)
        .accessibilityHidden(true)
    }
}
