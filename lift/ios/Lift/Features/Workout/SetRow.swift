import KoboComponents
import KoboTokens
import LiftStore
import SwiftUI

/// One set on the Workout screen: its name and target, the values saved or logged on it, and a large check that
/// logs it in one tap (or un-logs it). Tapping the values opens the editor, which never logs. Skip and Remove sit in
/// the context menu.
struct SetRow: View {
    @Environment(\.koboTheme) private var theme
    let item: WorkoutSetItem
    let onLog: () -> Void
    let onEdit: () -> Void
    let onSkip: () -> Void
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: Space.md) {
            Button(action: onEdit) { values }
                .buttonStyle(.plain)
                .accessibilityHint(Text("Edit weight and reps"))
            IconButton(
                item.status == .skipped ? "forward.fill" : "checkmark",
                verbatimAccessibilityLabel: logLabel,
                style: item.status == .planned ? .tonal : .solid,
                size: .large,
                action: onLog
            )
        }
        .padding(.horizontal, Space.lg)
        .padding(.vertical, Space.sm)
        .frame(maxWidth: .infinity, minHeight: Size.rowMinHeight, alignment: .leading)
        .overlay(alignment: .top) { Separator(leadingInset: Space.lg) }
        .contextMenu {
            if item.status == .planned {
                Button("Skip set", systemImage: "forward", action: onSkip)
            }
            Button("Remove set", systemImage: "trash", role: .destructive, action: onRemove)
        }
    }

    private var values: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            Text(verbatim: item.title)
                .font(theme.font(.footnote).weight(.semibold))
                .foregroundStyle(theme.palette.textSecondary)
            Text(verbatim: item.target)
                .font(theme.font(.body).monospacedDigit())
                .foregroundStyle(item.status == .skipped ? theme.palette.textTertiary : theme.palette.textPrimary)
            if let detail {
                Text(verbatim: detail)
                    .font(theme.font(.subheadline).monospacedDigit())
                    .foregroundStyle(item.status == .done ? theme.palette.accentText : theme.palette.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }

    /// "Logged 5 @ 100 kg", "Saved 6 @ 100 kg" or "Skipped"; nil for a planned set with nothing saved.
    private var detail: String? {
        switch item.status {
        case .done: item.actual.map { String(localized: "Logged \($0)") } ?? String(localized: "Logged")
        case .skipped: String(localized: "Skipped")
        case .planned: item.actual.map { String(localized: "Saved \($0)") }
        }
    }

    private var logLabel: String {
        item.status == .planned ? String(localized: "Log \(item.title)") : String(localized: "Undo \(item.title)")
    }
}
