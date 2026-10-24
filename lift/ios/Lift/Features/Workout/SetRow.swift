import KoboComponents
import KoboTokens
import LiftCore
import LiftStore
import SwiftUI

/// The set grid's column widths at the default text size. The header and the rows scale them with Dynamic Type, so
/// the columns stay lined up.
nonisolated enum SetGridWidth {
    static let badge = Size.iconLg + Space.xs
    static let weight = Size.thumbnail + Space.lg
    static let reps = Size.thumbnail
    /// The visible height of the row's pills and check, a step under the 44 pt touch target they keep.
    static let control = Size.buttonHeightCompact
    /// The grid's inset inside its card: the card inset every card's content uses.
    static let inset = Space.cardInset
}

/// The resting set's highlight strength (a maths constant, not a colour).
nonisolated enum RestingRow {
    static let washOpacity: Double = 0.5
}

/// One set in the grid: its badge, the same set last time, weight and reps pills that open the editor (which never
/// logs), and a check that logs it in one tap (or un-logs it). Skip and Remove sit in the context menu (Remove is also
/// in the editor). While a rest runs before this set, its check is a ring filling through the rest and "Rest 0:36 /
/// 2:00" takes the place of last time, so the rest adds no height. At accessibility sizes the row stacks, so nothing
/// is cut off.
struct SetRow: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @ScaledMetric(relativeTo: .body) private var badgeWidth = SetGridWidth.badge
    @ScaledMetric(relativeTo: .body) private var weightWidth = SetGridWidth.weight
    @ScaledMetric(relativeTo: .body) private var repsWidth = SetGridWidth.reps
    @ScaledMetric(relativeTo: .body) private var controlHeight = SetGridWidth.control
    let item: WorkoutSetItem
    let unit: WeightUnit
    /// The rest running now, before this set (the set to do next); nil on every other row. The row gets a soft accent
    /// wash so the eye finds it.
    let rest: RestTimer?
    let onLog: () -> Void
    let onEdit: () -> Void
    let onSkip: () -> Void
    let onRemove: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            if dynamicTypeSize.isAccessibilitySize { stacked } else { grid }
            if let detail = WorkoutText.setDetail(rpe: item.rpe, note: item.note) {
                SetNoteLine(text: detail, indent: dynamicTypeSize.isAccessibilitySize ? 0 : badgeWidth + Space.sm)
                    .padding(.bottom, Space.xs)
            }
        }
        .padding(.horizontal, SetGridWidth.inset)
        .padding(.vertical, Space.xxs)
        .frame(maxWidth: .infinity, minHeight: Size.minTouch, alignment: .leading)
        .background(rest != nil ? theme.palette.accentSoft.opacity(RestingRow.washOpacity) : .clear)
        .koboAnimation(.state, value: rest != nil)
        .overlay(alignment: .top) { Separator() }  // edge to edge of the card
        .contextMenu {
            if item.status == .planned {
                Button("Skip set", systemImage: "forward", action: onSkip)
            }
            Button("Remove set", systemImage: "trash", role: .destructive, action: onRemove)
        }
    }

    private var grid: some View {
        HStack(spacing: Space.sm) {
            HStack(spacing: Space.sm) {
                Text(verbatim: item.badge)
                    .font(theme.font(.subheadline).weight(.semibold).monospacedDigit())
                    .foregroundStyle(badgeColor)
                    .frame(width: badgeWidth, alignment: .leading)  // on the card's inset, like the exercise name
                Group {
                    if let rest {
                        Text("Rest \(rest.elapsedText) / \(rest.totalText)")
                            .font(theme.font(.subheadline).weight(.bold).monospacedDigit())
                            .foregroundStyle(theme.palette.accentText)
                    } else {
                        Text(verbatim: item.previous ?? "—")
                            .font(theme.font(.subheadline).monospacedDigit())
                            .foregroundStyle(theme.palette.textSecondary)
                    }
                }
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Text(verbatim: item.title))
            .accessibilityValue(previousLabel)
            pill(item.weight, label: weightLabel)
                .frame(width: weightWidth)
            pill(item.reps, label: repsLabel)
                .frame(width: repsWidth)
            check
        }
    }

    private var stacked: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            HStack(spacing: Space.sm) {
                VStack(alignment: .leading, spacing: Space.xxs) {
                    Text(verbatim: item.title)
                        .font(theme.font(.subheadline).weight(.semibold))
                        .foregroundStyle(badgeColor)
                    if let previous = item.previous {
                        Text("Last time \(previous)")
                            .font(theme.font(.footnote).monospacedDigit())
                            .foregroundStyle(theme.palette.textSecondary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                check
            }
            ViewThatFits(in: .horizontal) {
                HStack(spacing: Space.sm) { stackedPills }
                VStack(spacing: Space.sm) { stackedPills }
            }
        }
        .padding(.vertical, Space.sm)
    }

    @ViewBuilder private var stackedPills: some View {
        pill("\(item.weight) \(unit.rawValue)", label: weightLabel)
        pill(String(localized: "\(item.reps) reps"), label: repsLabel)
    }

    /// A tonal capsule showing a value; tapping it opens the editor. It is as tall as the log check beside it
    /// (`SetGridWidth.control`, inside a full touch target), so every control in the row shares one height and, being a
    /// capsule, the check's round ends.
    private func pill(_ value: String, label: Text) -> some View {
        Button(action: onEdit) {
            Text(verbatim: value)
                .font(theme.font(.body).weight(.semibold).monospacedDigit())
                .foregroundStyle(pillInk)
                .strikethrough(item.status == .skipped)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .padding(.horizontal, Space.sm)
                .frame(maxWidth: .infinity, minHeight: controlHeight)
                .background(Capsule().fill(pillFill))
                .padding(.vertical, max(Size.minTouch - controlHeight, 0) / 2)  // the touch target stays 44 pt
                .contentShape(Rectangle())
        }
        .buttonStyle(.pressFeedback(.scale))
        .accessibilityLabel(label)
        .accessibilityHint(Text("Edit weight and reps"))
    }

    @ViewBuilder private var check: some View {
        if let rest, item.status == .planned {
            RestRingCheck(rest: rest, label: logLabel, action: onLog)
        } else {
            logCheck
        }
    }

    /// Flat, not glass: the set rows are content, and a column of glass circles read as noise (Paolo, 2026-10-24).
    /// Glass stays on the floating controls, such as Start workout.
    private var logCheck: some View {
        IconButton(
            item.status == .skipped ? "forward.fill" : "checkmark",
            verbatimAccessibilityLabel: logLabel,
            style: item.status == .planned ? .tonal : .solid,
            size: .small,
            action: onLog
        )
        .transformEnvironment(\.koboTheme) { $0.surfaceStyle = .solid }
    }

    private var badgeColor: Color {
        switch item.status {
        case .done: theme.palette.accentText
        case .skipped: theme.palette.textTertiary
        case .planned: theme.palette.textSecondary
        }
    }

    private var pillInk: Color {
        switch item.status {
        case .done: theme.palette.accentText
        case .skipped: theme.palette.textTertiary
        case .planned: theme.palette.textPrimary
        }
    }

    private var pillFill: Color {
        item.status == .done ? theme.palette.accentSoft : theme.palette.surfaceRaised
    }

    private var weightLabel: Text { Text("Weight \(item.weight) \(unit.rawValue)") }
    private var repsLabel: Text { Text("Reps \(item.reps)") }

    /// "Last time 5 × 85", "Skipped" or "Logged"; empty for a planned set never done before.
    private var previousLabel: Text {
        let last = item.previous.map { String(localized: "Last time \($0)") }
        let status: String? =
            switch item.status {
            case .done: String(localized: "Logged")
            case .skipped: String(localized: "Skipped")
            case .planned: nil
            }
        return Text(verbatim: [status, last].compactMap(\.self).joined(separator: ", "))
    }

    private var logLabel: String {
        item.status == .planned ? String(localized: "Log \(item.title)") : String(localized: "Undo \(item.title)")
    }
}

/// The check of the set after a running rest: a ring that fills as the rest goes by, with the check inside. A tap
/// logs the set, like the plain check.
private struct RestRingCheck: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var size = SetGridWidth.control
    let rest: RestTimer
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ProgressRing(
                progress: rest.total > 0 ? Double(rest.elapsed) / Double(rest.total) : 0,
                lineWidth: Space.xs,
                trackColor: theme.palette.accentSoft,
                verbatimAccessibilityLabel: label
            ) {
                Image(systemName: "checkmark")
                    .font(theme.font(.subheadline).weight(.bold))
                    .foregroundStyle(theme.palette.textSecondary)
            }
            .frame(width: size, height: size)
            .contentShape(Circle())
            .frame(minWidth: Size.minTouch, minHeight: Size.minTouch)  // the touch target stays 44 pt
            .contentShape(Rectangle())
        }
        .buttonStyle(.pressFeedback(.scale))
        .accessibilityLabel(Text(verbatim: label))
        .accessibilityValue(Text("Rested \(rest.elapsedText) of \(rest.totalText)"))
    }
}

