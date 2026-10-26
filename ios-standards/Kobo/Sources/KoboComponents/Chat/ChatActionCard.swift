import KoboTokens
import SwiftUI

/// Changes an assistant proposes, for the reader to apply: a title, one row per change (its glyph, what it changes,
/// and the old value struck through before the new one), optional notes, then Apply and Dismiss. Nothing changes until
/// Apply. After it, the card says "Applied" and offers Undo when the caller can take the changes back. A dismissed,
/// superseded or expired card dims its rows and drops the buttons. At accessibility text sizes the buttons stack.
///
///     ChatActionCard(verbatim: "2 changes this week", items: items, status: status,
///                    onApply: apply, onDismiss: dismiss, onUndo: undo)
public struct ChatActionCard: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    private let title: String
    private let items: [ChatActionItem]
    private let notes: [String]
    private let status: ChatActionStatus
    private let onApply: () -> Void
    private let onDismiss: () -> Void
    private let onUndo: (() -> Void)?

    /// A proposal card. `notes` are warnings the reader should see before applying.
    public init(
        verbatim title: String,
        items: [ChatActionItem],
        notes: [String] = [],
        status: ChatActionStatus,
        onApply: @escaping () -> Void,
        onDismiss: @escaping () -> Void,
        onUndo: (() -> Void)? = nil
    ) {
        self.title = title
        self.items = items
        self.notes = notes
        self.status = status
        self.onApply = onApply
        self.onDismiss = onDismiss
        self.onUndo = onUndo
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            HStack(alignment: .firstTextBaseline) {
                Text(verbatim: title)
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: Space.sm)
                ChatActionStatusPill(status: status)
            }
            VStack(alignment: .leading, spacing: Space.md) {
                ForEach(items) { ChatActionRow(item: $0) }
            }
            .opacity(status.isCurrent ? 1 : 0.55)
            ForEach(Array(notes.enumerated()), id: \.offset) { _, note in
                InlineNotice(verbatim: note, tone: .warning)
            }
            footer
        }
        .koboCard()
        .koboAnimation(.state, value: status)
        .koboFeedback(status == .applied ? .success : nil, trigger: status)
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private var footer: some View {
        if status.showsActions, dynamicTypeSize.isAccessibilitySize {
            VStack(spacing: Space.sm) {  // stacked at accessibility sizes, so neither label breaks; Apply first
                applyButton
                dismissButton
            }
        } else if status.showsActions {
            HStack(spacing: Space.sm) {
                dismissButton
                applyButton
            }
        } else if status == .applied, let onUndo {
            Button(action: onUndo) { Text("Undo", bundle: .module) }
                .buttonStyle(.kobo(.plain, size: .compact))
        }
    }

    private var applyButton: some View {
        Button(action: onApply) { Text("Apply", bundle: .module) }
            .buttonStyle(.kobo(.primary, width: .full, isLoading: status == .applying))
    }

    private var dismissButton: some View {
        Button(action: onDismiss) { Text("Dismiss", bundle: .module) }
            .buttonStyle(.kobo(.secondary, width: .full))
            .disabled(status == .applying)
    }
}

/// The state pill in the card's corner, for every status but pending.
private struct ChatActionStatusPill: View {
    let status: ChatActionStatus

    var body: some View {
        switch status {
        case .pending, .applying: EmptyView()
        case .applied: StatusPill(verbatim: String(localized: "Applied", bundle: .module), tone: .success)
        case .dismissed: StatusPill(verbatim: String(localized: "Dismissed", bundle: .module), tone: .neutral)
        case .superseded: StatusPill(verbatim: String(localized: "Replaced", bundle: .module), tone: .neutral)
        case .expired: StatusPill(verbatim: String(localized: "Out of date", bundle: .module), tone: .warning)
        }
    }
}

/// One change: glyph, title, and "old → new" (or the caption). VoiceOver: "Move, Team review, from Tue, to Wed".
private struct ChatActionRow: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var glyph = Size.iconMd
    let item: ChatActionItem

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.md) {
            Image(systemName: item.change.systemImage)
                .font(.system(size: glyph))
                .foregroundStyle(tint)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Space.xxs) {
                Text(verbatim: item.title)
                    .font(theme.font(.body).weight(.semibold))
                    .foregroundStyle(theme.palette.textPrimary)
                    .strikethrough(item.change == .remove)
                detail
            }
            .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(spoken)
    }

    @ViewBuilder
    private var detail: some View {
        if item.previous != nil || item.detail != nil {
            HStack(spacing: Space.xs) {
                if let previous = item.previous {
                    Text(verbatim: previous).strikethrough().foregroundStyle(theme.palette.textTertiary)
                    Image(systemName: "arrow.right").foregroundStyle(theme.palette.textTertiary)
                        .accessibilityHidden(true)
                }
                if let detail = item.detail {
                    Text(verbatim: detail).foregroundStyle(theme.palette.textSecondary)
                }
            }
            .font(theme.font(.subheadline))
        }
    }

    private var tint: Color {
        switch item.change {
        case .add: theme.palette.success.ink
        case .remove: theme.palette.danger.ink
        case .move, .edit: theme.palette.accentText
        }
    }

    private var spoken: Text {
        let verb: Text =
            switch item.change {
            case .add: Text("Add", bundle: .module)
            case .remove: Text("Remove", bundle: .module)
            case .move: Text("Move", bundle: .module)
            case .edit: Text("Change", bundle: .module)
            }
        let from = item.previous.map { Text(", from \($0)", bundle: .module) } ?? Text(verbatim: "")
        let to = item.detail.map { Text(verbatim: ", \($0)") } ?? Text(verbatim: "")
        return Text("\(verb), \(item.title)\(from)\(to)", bundle: .module)
    }
}

#if DEBUG
    private struct ChatActionCardPreview: View {
        let status: ChatActionStatus

        var body: some View {
            ChatActionCard(
                verbatim: "3 changes this week",
                items: [
                    ChatActionItem(
                        id: "1",
                        change: .move,
                        title: "Team review",
                        detail: "Wed 09:00",
                        previous: "Tue 17:00"
                    ),
                    ChatActionItem(id: "2", change: .remove, title: "Design sync", detail: "Wed 10:00"),
                    ChatActionItem(id: "3", change: .add, title: "Lunch with the new hire", detail: "Tue 12:30 · 1 h"),
                ],
                notes: status == .pending ? ["Wednesday now has three meetings in a row."] : [],
                status: status,
                onApply: {},
                onDismiss: {},
                onUndo: {}
            )
            .padding(Space.gutter)
            .screenCanvas()
        }
    }

    #Preview("Action card") { ChatActionCardPreview(status: .pending) }
    #Preview("Action card · applied, dark") { ChatActionCardPreview(status: .applied).preferredColorScheme(.dark) }
    #Preview("Action card · AX3") { ChatActionCardPreview(status: .pending).dynamicTypeSize(.accessibility3) }
#endif
