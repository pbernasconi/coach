import KoboTokens
import SwiftUI

/// Changes an assistant proposes, for the reader to apply: a quiet title, one row per change (a plain glyph, what it
/// changes, and the old value struck through before the new one), optional notes, then Dismiss and Apply. Apply is the
/// card's only filled control. Nothing changes until Apply. Afterwards one footer line says where the card stands
/// ("✓ Applied · Undo", "Dismissed"), and a card that no longer applies dims its rows. At accessibility text sizes the
/// buttons stack, Apply first.
///
///     ChatActionCard(verbatim: "Plan changes", items: items, status: status,
///                    onApply: apply, onDismiss: dismiss, onUndo: undo)
public struct ChatActionCard: View {
    @Environment(\.koboTheme) private var theme
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
            Text(verbatim: title)
                .font(theme.font(.subheadline))
                .foregroundStyle(theme.palette.textSecondary)
                .accessibilityAddTraits(.isHeader)
            VStack(alignment: .leading, spacing: Space.md) {
                ForEach(items) { ChatActionRow(item: $0) }
            }
            .opacity(status.isCurrent ? 1 : 0.5)
            ForEach(Array(notes.enumerated()), id: \.offset) { _, note in
                ChatActionNote(text: note)
            }
            ChatActionFooter(status: status, onApply: onApply, onDismiss: onDismiss, onUndo: onUndo)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Space.lg)
        .modifier(ChatActionCardSurface())
        .koboAnimation(.state, value: status)
        .koboFeedback(status == .applied ? .success : nil, trigger: status)
        .accessibilityElement(children: .contain)
    }
}

/// The card's surface: the raised fill, a hairline in light mode only, no shadow.
private struct ChatActionCardSurface: ViewModifier {
    @Environment(\.koboTheme) private var theme
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: Radius.lg + Space.xs, style: .continuous)
        content
            .background(theme.palette.surface, in: shape)
            .overlay {
                if colorScheme == .light { shape.strokeBorder(theme.palette.separator, lineWidth: Size.hairline) }
            }
    }
}

/// One warning: a small triangle in the warning ink, then the text in the secondary ink. No fill.
private struct ChatActionNote: View {
    @Environment(\.koboTheme) private var theme
    let text: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.xs) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(theme.palette.warning.ink)
                .accessibilityHidden(true)
            Text(verbatim: text)
                .foregroundStyle(theme.palette.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .font(theme.font(.footnote))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text("Warning: \(text)", bundle: .module))
    }
}

/// One change: a plain glyph, the title, and "old → new" (or the caption). VoiceOver: "Move, Team review, from Tue, Wed".
private struct ChatActionRow: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .subheadline) private var glyph = Size.iconSm
    let item: ChatActionItem

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.md) {
            Image(systemName: Self.symbol(item.change))
                .font(.system(size: glyph, weight: .semibold))
                .foregroundStyle(theme.palette.textSecondary)
                .frame(width: glyph)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Space.xxs) {
                Text(verbatim: item.title)
                    .font(theme.font(.body).weight(.medium))
                    .foregroundStyle(item.change == .remove ? theme.palette.textSecondary : theme.palette.textPrimary)
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

    /// A plain symbol per change; no fill and no colour, so the card stays quiet.
    static func symbol(_ change: ChatActionItem.Change) -> String {
        switch change {
        case .add: "plus"
        case .remove: "minus"
        case .move: "arrow.right"
        case .edit: "pencil"
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
