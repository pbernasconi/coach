import KoboTokens
import SwiftUI

/// A row of a `ChatChangeCard`: a small glyph, title over caption, and the tag. VoiceOver reads it as one line.
struct ChatChangeRowView: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .subheadline) private var glyph = Size.iconSm
    let row: ChatChangeRow

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
            if let symbol = row.systemImage {
                Image(systemName: symbol)
                    .font(.system(size: glyph, weight: .medium))
                    .foregroundStyle(theme.palette.textTertiary)
                    .frame(width: glyph + Space.xs)
                    .accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 0) {
                Text(verbatim: row.title)
                    .font(theme.font(.subheadline).weight(.semibold))
                    .foregroundStyle(row.tone == .removed ? theme.palette.textSecondary : theme.palette.textPrimary)
                if let caption = row.caption, !caption.isEmpty {
                    Text(verbatim: caption)
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)
            ChatChangeTag(text: row.tag, tone: row.tone)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: row.spoken))
    }
}

/// The row's one tag: soft fill, ink text. The words say what happens; the tint only helps. The neutral tag takes the
/// card's inset fill, since the neutral soft grey would melt into the card.
private struct ChatChangeTag: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.colorScheme) private var colorScheme
    let text: String
    let tone: ChatChangeRow.Tone

    var body: some View {
        let colors = theme.palette.status(tone.paletteTone)
        Text(verbatim: text)
            .font(theme.font(.caption).weight(.semibold))
            .foregroundStyle(colors.ink)
            .padding(.horizontal, Space.sm)
            .padding(.vertical, Space.xxs)
            .background(tone == .removed ? theme.palette.chatCardInset(colorScheme) : colors.soft, in: Capsule())
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

/// One short line under the rows: a warning, what happened after Apply, or "Checked against your plan". A small toned
/// glyph carries the meaning and the words stay quiet, so a note costs a line, not a boxed notice.
struct ChatChangeNote: View {
    @Environment(\.koboTheme) private var theme
    let text: String
    let tone: Tone

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.xs) {
            Image(systemName: tone == .success ? "checkmark" : tone.feedbackSymbol)
                .font(theme.font(.caption).weight(.semibold))
                .foregroundStyle(theme.palette.status(tone).ink)
                .accessibilityHidden(true)
            Text(verbatim: text)
                .font(theme.font(.footnote))
                .foregroundStyle(tone == .warning ? theme.palette.textPrimary : theme.palette.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }
}

/// The applied card's Undo: small accent ink on the summary line.
struct ChatChangeUndoButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label {
                Text("Undo", bundle: .module)
            } icon: {
                Image(systemName: "arrow.uturn.backward")
            }
        }
        .buttonStyle(.kobo(.plain, size: .compact, width: .inline))
    }
}

/// The card's buttons, small and at the trailing edge: Not now / Apply N changes while pending, Keep / Undo N while
/// asking. Full width and stacked (primary first) at accessibility sizes.
struct ChatChangeFooter: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let status: ChatActionStatus
    let count: Int
    let undoConfirm: ChatUndoConfirm?
    let actions: ChatChangeActions

    var body: some View {
        if status.showsActions {
            pair {
                Button(action: actions.dismiss) { Text("Not now", bundle: .module) }
                    .buttonStyle(.kobo(.outlined, size: .compact, width: width))
                    .disabled(status == .applying)
            } primary: {
                Button(action: actions.apply) { applyLabel }
                    .buttonStyle(.kobo(.primary, size: .compact, width: width, isLoading: status == .applying))
            }
        } else if status == .applied, let undoConfirm {
            VStack(alignment: .leading, spacing: Space.sm) {
                ChatChangeNote(text: undoConfirm.message, tone: .info)
                pair {
                    Button {
                        actions.cancelUndo?()
                    } label: {
                        Text("Keep", bundle: .module)
                    }
                    .buttonStyle(.kobo(.outlined, size: .compact, width: width))
                } primary: {
                    Button {
                        actions.confirmUndo?()
                    } label: {
                        Text("Undo \(undoConfirm.count)", bundle: .module)
                    }
                    .buttonStyle(.kobo(.primary, size: .compact, width: width))
                }
            }
        }
    }

    private var width: KoboButtonStyle.Width { dynamicTypeSize.isAccessibilitySize ? .full : .hug }

    private var applyLabel: Text {
        count > 1 ? Text("Apply \(count) changes", bundle: .module) : Text("Apply", bundle: .module)
    }

    @ViewBuilder
    private func pair(@ViewBuilder secondary: () -> some View, @ViewBuilder primary: () -> some View) -> some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(spacing: Space.sm) {
                primary()
                secondary()
            }
        } else {
            HStack(spacing: Space.sm) {
                Spacer(minLength: 0)
                secondary()
                primary()
            }
        }
    }
}

#if DEBUG
    struct ChatChangeCardPreview: View {
        let status: ChatActionStatus
        var confirming = false

        static let sections: [ChatChangeSection] = [
            ChatChangeSection(
                id: "tue",
                title: "Tue 3 Mar",
                rows: [
                    ChatChangeRow(
                        id: "1",
                        title: "Design sync",
                        caption: "10:00 · 30 min",
                        tag: "Skipped",
                        tone: .removed,
                        systemImage: "person.2"
                    )
                ]
            ),
            ChatChangeSection(
                id: "wed",
                title: "Wed 4 Mar",
                rows: [
                    ChatChangeRow(
                        id: "2",
                        title: "Team review",
                        caption: "09:00 · 1 h",
                        tag: "From Tue",
                        tone: .changed,
                        systemImage: "person.3"
                    ),
                    ChatChangeRow(
                        id: "3",
                        title: "Lunch with the new hire",
                        caption: "12:30 · 1 h",
                        tag: "New",
                        tone: .added,
                        systemImage: "fork.knife"
                    ),
                ]
            ),
        ]

        var body: some View {
            ScrollView {
                ChatChangeCard(
                    verbatim: "Move the review, lunch on Wednesday",
                    summary: "3 changes · Tue 3 to Wed 4 Mar",
                    sections: Self.sections,
                    checked: "Checked against your calendar: no clashes",
                    status: status,
                    undoConfirm: confirming
                        ? ChatUndoConfirm(
                            message: "You moved Team review since, so Undo leaves it as you set it.",
                            count: 2
                        )
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
