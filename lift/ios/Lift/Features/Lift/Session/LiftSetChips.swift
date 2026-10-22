import KoboComponents
import KoboTokens
import SwiftUI

/// The working sets of one exercise as small chips, in order: "120 × 5", the top set filled, an arrow when it beat the
/// target, its RPE after it, a skipped set struck through, a planned one dashed. Warm-ups stay on the exercise page.
struct LiftSetChips: View {
    let sets: [LiftSessionSet]
    /// The server's top set ("122.5 kg × 5"): that chip is filled.
    let topSetText: String?

    var body: some View {
        FlowLayout(spacing: Space.xs) {
            ForEach(working) { set in
                LiftSetChip(set: set, isTop: set.id == topSetID)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private var working: [LiftSessionSet] {
        sets.filter { !$0.isWarmUp }
    }

    /// The first done set that is the top set: one chip is filled, even when two sets were the same.
    private var topSetID: String? {
        working.first { $0.status == "done" && $0.text == topSetText }?.id
    }
}

private struct LiftSetChip: View {
    @Environment(\.koboTheme) private var theme
    let set: LiftSessionSet
    let isTop: Bool

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.xxs) {
            Text(verbatim: Self.short(set.text))
                .font(theme.font(.footnote).weight(isTop ? .semibold : .regular).monospacedDigit())
                .strikethrough(set.status == "skipped")
            if set.beatTarget {
                Image(systemName: "arrow.up")
                    .font(theme.font(.caption).weight(.bold))
                    .foregroundStyle(theme.palette.success.ink)
                    .accessibilityLabel(Text("Above target"))
            }
            if let rpe = set.rpeText {
                // "@8": the RPE, on the same line so every chip is one height.
                Text(verbatim: rpe.replacingOccurrences(of: "RPE ", with: "@"))
                    .font(theme.font(.caption).monospacedDigit())
                    .foregroundStyle(isTop ? theme.palette.info.ink.opacity(0.7) : theme.palette.textTertiary)
                    .accessibilityLabel(Text(verbatim: rpe))
            }
        }
        .foregroundStyle(ink)
        .padding(.horizontal, Space.sm)
        .padding(.vertical, Space.xxs)
        .background(fill, in: shape)
        .overlay {
            if set.status == "planned" {
                shape.strokeBorder(theme.palette.textTertiary, style: StrokeStyle(lineWidth: Size.hairline * 2, dash: [3, 3]))
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(isTop ? Text("Top set") : Text(verbatim: ""))
    }

    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: Radius.xs, style: .continuous) }

    private var fill: Color {
        if isTop { return theme.palette.info.soft }
        return set.status == "planned" ? .clear : theme.palette.surfaceSunken
    }

    private var ink: Color {
        switch set.status {
        case "done": isTop ? theme.palette.info.ink : theme.palette.textPrimary
        default: theme.palette.textTertiary
        }
    }

    /// "120 kg × 5" → "120 × 5": the row already says the unit (e1RM), and chips stay short.
    static func short(_ text: String) -> String {
        text.replacingOccurrences(of: " kg", with: "").replacingOccurrences(of: " lb", with: "")
    }
}
