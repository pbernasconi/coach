import KoboTokens
import SwiftUI

/// The bottom of a `ChatActionCard`: while the card is open, a plain Dismiss and a compact filled Apply at the trailing
/// edge (stacked, Apply first, at accessibility sizes); afterwards one quiet line ("✓ Applied · Undo", "Dismissed").
struct ChatActionFooter: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let status: ChatActionStatus
    let onApply: () -> Void
    let onDismiss: () -> Void
    let onUndo: (() -> Void)?

    var body: some View {
        if status.showsActions {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(spacing: Space.xs) {
                    apply.buttonStyle(.kobo(.primary, width: .full, isLoading: status == .applying))
                    dismiss.frame(maxWidth: .infinity)
                }
            } else {
                HStack(spacing: Space.xs) {
                    Spacer(minLength: 0)
                    dismiss
                    apply.buttonStyle(.kobo(.primary, size: .compact, isLoading: status == .applying))
                }
            }
        } else {
            statusLine
        }
    }

    private var apply: some View {
        Button(action: onApply) { Text("Apply", bundle: .module) }
    }

    private var dismiss: some View {
        Button(action: onDismiss) {
            Text("Dismiss", bundle: .module)
                .font(theme.font(.subheadline).weight(.medium))
                .foregroundStyle(theme.palette.textSecondary)
                .padding(.horizontal, Space.sm)
                .frame(minHeight: Size.minTouch)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(status == .applying)
    }

    @ViewBuilder
    private var statusLine: some View {
        HStack(spacing: Space.xs) {
            switch status {
            case .applied:
                Image(systemName: "checkmark").foregroundStyle(theme.palette.success.ink).accessibilityHidden(true)
                Text("Applied", bundle: .module).foregroundStyle(theme.palette.textSecondary)
                if let onUndo {
                    Text(verbatim: "·").foregroundStyle(theme.palette.textTertiary).accessibilityHidden(true)
                    Button(action: onUndo) {
                        Text("Undo", bundle: .module)
                            .foregroundStyle(theme.palette.accentText)
                            .frame(minHeight: Size.minTouch)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            case .undone: Text("Undone", bundle: .module).foregroundStyle(theme.palette.textTertiary)
            case .dismissed: Text("Dismissed", bundle: .module).foregroundStyle(theme.palette.textTertiary)
            case .superseded:
                Text("Replaced by a newer plan", bundle: .module).foregroundStyle(theme.palette.textTertiary)
            case .expired: Text("Out of date", bundle: .module).foregroundStyle(theme.palette.textTertiary)
            case .pending, .applying: EmptyView()
            }
        }
        .font(theme.font(.footnote).weight(.medium))
        .frame(minHeight: Size.minTouch, alignment: .leading)
    }
}
