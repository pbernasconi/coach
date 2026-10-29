import KoboTokens
import SwiftUI

/// A row of a `ChatChangeCard`: icon tile, title over caption, and the tag. VoiceOver reads it as one line.
struct ChatChangeRowView: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var tile = Size.minTouch - Space.sm
    @ScaledMetric(relativeTo: .body) private var glyph = Size.iconSm + 2
    let row: ChatChangeRow

    var body: some View {
        HStack(alignment: .center, spacing: Space.md) {
            if let symbol = row.systemImage {
                Image(systemName: symbol)
                    .font(.system(size: glyph, weight: .medium))
                    .foregroundStyle(row.tone == .removed ? theme.palette.textTertiary : theme.palette.textSecondary)
                    .frame(width: tile, height: tile)
                    .background(theme.palette.surfaceRaised, in: RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
                    .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: Space.xxs) {
                Text(verbatim: row.title)
                    .font(theme.font(.body).weight(.semibold))
                    .foregroundStyle(row.tone == .removed ? theme.palette.textSecondary : theme.palette.textPrimary)
                if let caption = row.caption, !caption.isEmpty {
                    Text(verbatim: caption)
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
            ChatChangeTag(text: row.tag, tone: row.tone)
        }
        .frame(minHeight: Size.minTouch)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: row.spoken))
    }
}

/// The row's one tag: soft fill, ink text. The words say what happens; the tint only helps.
private struct ChatChangeTag: View {
    @Environment(\.koboTheme) private var theme
    let text: String
    let tone: ChatChangeRow.Tone

    var body: some View {
        let colors = theme.palette.status(tone.paletteTone)
        Text(verbatim: text)
            .font(theme.font(.footnote).weight(.semibold))
            .foregroundStyle(colors.ink)
            .padding(.horizontal, Space.sm)
            .padding(.vertical, Space.xs)
            .background(colors.soft, in: Capsule())
            .fixedSize()
    }
}

extension ChatChangeRow.Tone {
    var paletteTone: Tone {
        switch self {
        case .changed: .accent
        case .added: .success
        case .removed: .neutral
        }
    }
}

/// "Checked against your plan: no clashes, no doubles", on a raised strip with a shield.
struct ChatChangeChecked: View {
    @Environment(\.koboTheme) private var theme
    let text: String

    var body: some View {
        Label {
            Text(verbatim: text).foregroundStyle(theme.palette.textSecondary)
        } icon: {
            Image(systemName: "checkmark.shield").foregroundStyle(theme.palette.success.ink)
        }
        .font(theme.font(.footnote))
        .padding(.horizontal, Space.md)
        .padding(.vertical, Space.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.palette.surfaceRaised, in: RoundedRectangle(cornerRadius: Radius.sm, style: .continuous))
    }
}

/// The card's buttons: Not now / Apply N changes while pending, Undo once applied, Keep / Undo N while asking.
struct ChatChangeFooter: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let status: ChatActionStatus
    let count: Int
    let undoConfirm: ChatUndoConfirm?
    let actions: ChatChangeActions

    var body: some View {
        if status.showsActions {
            pair {
                Button(action: actions.dismiss) { Text("Not now", bundle: .module) }
                    .buttonStyle(.kobo(.outlined, width: .full))
                    .disabled(status == .applying)
            } primary: {
                Button(action: actions.apply) { applyLabel }
                    .buttonStyle(.kobo(.primary, width: .full, isLoading: status == .applying))
            }
        } else if status == .applied, let undoConfirm {
            VStack(alignment: .leading, spacing: Space.md) {
                InlineNotice(verbatim: undoConfirm.message, tone: .neutral)
                pair {
                    Button { actions.cancelUndo?() } label: { Text("Keep", bundle: .module) }
                        .buttonStyle(.kobo(.outlined, width: .full))
                } primary: {
                    Button { actions.confirmUndo?() } label: { Text("Undo \(undoConfirm.count)", bundle: .module) }
                        .buttonStyle(.kobo(.primary, width: .full))
                }
            }
        } else if status == .applied, let undo = actions.undo {
            Button(action: undo) { Label { Text("Undo", bundle: .module) } icon: { Image(systemName: "arrow.uturn.backward") } }
                .buttonStyle(.kobo(.plain, size: .compact))
        }
    }

    private var applyLabel: Text {
        count > 1 ? Text("Apply \(count) changes", bundle: .module) : Text("Apply", bundle: .module)
    }

    /// Two buttons side by side, the primary wider; stacked (primary first) at accessibility sizes.
    @ViewBuilder
    private func pair(@ViewBuilder secondary: () -> some View, @ViewBuilder primary: () -> some View) -> some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(spacing: Space.sm) {
                primary()
                secondary()
            }
        } else {
            HStack(spacing: Space.sm) {
                secondary().layoutPriority(0)
                primary().layoutPriority(1)
            }
        }
    }
}

#if DEBUG
    struct ChatChangeCardPreview: View {
        let status: ChatActionStatus
        var confirming = false

        var body: some View {
            ScrollView {
                ChatChangeCard(
                    verbatim: "Move the review, lunch on Wednesday",
                    summary: "3 changes · Tue 3 to Wed 4 Mar",
                    sections: [
                        ChatChangeSection(id: "tue", title: "Tue 3 Mar", rows: [
                            ChatChangeRow(
                                id: "1", title: "Design sync", caption: "10:00 · 30 min", tag: "Skipped",
                                tone: .removed, systemImage: "person.2"
                            ),
                        ]),
                        ChatChangeSection(id: "wed", title: "Wed 4 Mar", rows: [
                            ChatChangeRow(
                                id: "2", title: "Team review", caption: "09:00 · 1 h", tag: "From Tue",
                                tone: .changed, systemImage: "person.3"
                            ),
                            ChatChangeRow(
                                id: "3", title: "Lunch with the new hire", caption: "12:30 · 1 h", tag: "New",
                                tone: .added, systemImage: "fork.knife"
                            ),
                        ]),
                    ],
                    checked: "Checked against your calendar: no clashes",
                    status: status,
                    undoConfirm: confirming
                        ? ChatUndoConfirm(message: "You moved Team review since, so Undo leaves it as you set it.", count: 2)
                        : nil,
                    onApply: {},
                    onDismiss: {},
                    onUndo: {}
                )
                .padding(Space.gutter)
            }
            .screenCanvas()
        }
    }
#endif
