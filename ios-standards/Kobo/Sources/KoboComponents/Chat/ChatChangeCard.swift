import KoboTokens
import SwiftUI

/// Changes an assistant proposes, shown as they will be: a title and summary, then sections (usually days), each row
/// with an icon, its caption and one quiet tag ("From Sat", "Skipped", "New"). Under them the warnings, an optional
/// check line ("Checked against your plan"), and Not now / Apply N changes. After Apply the card says so with Undo;
/// `result` lines say what didn't go as shown. When Undo can put back only part, `undoConfirm` asks first. Calm on
/// purpose: no struck-through text, no coloured change glyphs, one filled button.
///
///     ChatChangeCard(verbatim: "Move the review", summary: "2 changes · Tue to Wed", sections: days,
///                    status: status, onApply: apply, onDismiss: dismiss, onUndo: undo)
public struct ChatChangeCard: View {
    @Environment(\.koboTheme) private var theme
    private let title: String
    private let summary: String?
    private let sections: [ChatChangeSection]
    private let notes: [String]
    private let checked: String?
    private let result: [String]
    private let status: ChatActionStatus
    private let undoConfirm: ChatUndoConfirm?
    private let actions: ChatChangeActions

    /// - Parameters:
    ///   - notes: warnings to read before applying.
    ///   - checked: a line saying what was checked, shown while the card is pending.
    ///   - result: after Apply or Undo, what happened when it isn't simply what the rows show.
    public init(
        verbatim title: String,
        summary: String? = nil,
        sections: [ChatChangeSection],
        notes: [String] = [],
        checked: String? = nil,
        result: [String] = [],
        status: ChatActionStatus,
        undoConfirm: ChatUndoConfirm? = nil,
        onApply: @escaping () -> Void,
        onDismiss: @escaping () -> Void,
        onUndo: (() -> Void)? = nil,
        onConfirmUndo: (() -> Void)? = nil,
        onCancelUndo: (() -> Void)? = nil
    ) {
        self.title = title
        self.summary = summary
        self.sections = sections
        self.notes = notes
        self.checked = checked
        self.result = result
        self.status = status
        self.undoConfirm = undoConfirm
        self.actions = ChatChangeActions(
            apply: onApply,
            dismiss: onDismiss,
            undo: onUndo,
            confirmUndo: onConfirmUndo,
            cancelUndo: onCancelUndo
        )
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            header
            VStack(alignment: .leading, spacing: Space.lg) {
                ForEach(sections) { ChatChangeSectionView(section: $0, dimmed: !status.isCurrent) }
            }
            ForEach(Array(notes.enumerated()), id: \.offset) { _, note in
                InlineNotice(verbatim: note, tone: .warning)
            }
            ForEach(Array(result.enumerated()), id: \.offset) { _, line in
                InlineNotice(verbatim: line, tone: status == .expired ? .warning : .info)
            }
            if status == .pending, let checked {
                ChatChangeChecked(text: checked)
            }
            ChatChangeFooter(
                status: status,
                count: sections.rowCount,
                undoConfirm: undoConfirm,
                actions: actions
            )
        }
        .chatCard()
        .koboAnimation(.state, value: status)
        .koboAnimation(.state, value: undoConfirm)
        .koboFeedback(status == .applied ? .success : nil, trigger: status)
        .accessibilityElement(children: .contain)
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
            VStack(alignment: .leading, spacing: Space.xxs) {
                Text(verbatim: title)
                    .font(theme.font(.headline))
                    .foregroundStyle(theme.palette.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                if let summary {
                    Text(verbatim: summary)
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            Spacer(minLength: Space.sm)
            ChatChangeStatusPill(status: status)
        }
    }
}

/// The card's callbacks, kept together so the footer takes one value.
struct ChatChangeActions {
    let apply: () -> Void
    let dismiss: () -> Void
    let undo: (() -> Void)?
    let confirmUndo: (() -> Void)?
    let cancelUndo: (() -> Void)?
}

/// A day: its small heading over a hairline, then its rows.
private struct ChatChangeSectionView: View {
    @Environment(\.koboTheme) private var theme
    let section: ChatChangeSection
    let dimmed: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            HStack(spacing: Space.sm) {
                Text(verbatim: section.title.uppercased())
                    .font(theme.font(.caption).weight(.semibold))
                    .tracking(0.6)
                    .foregroundStyle(theme.palette.textSecondary)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityLabel(Text(verbatim: section.title))
                Rectangle().fill(theme.palette.separator).frame(height: Size.hairline * 2)
                    .accessibilityHidden(true)
            }
            ForEach(section.rows) { ChatChangeRowView(row: $0) }
        }
        .opacity(dimmed ? 0.55 : 1)
    }
}

/// The pill in the corner for every status but pending.
private struct ChatChangeStatusPill: View {
    let status: ChatActionStatus

    var body: some View {
        switch status {
        case .pending, .applying: EmptyView()
        case .applied: StatusPill(verbatim: String(localized: "Applied", bundle: .module), tone: .success)
        case .undone: StatusPill(verbatim: String(localized: "Undone", bundle: .module), tone: .neutral)
        case .dismissed: StatusPill(verbatim: String(localized: "Dismissed", bundle: .module), tone: .neutral)
        case .superseded: StatusPill(verbatim: String(localized: "Replaced", bundle: .module), tone: .neutral)
        case .expired: StatusPill(verbatim: String(localized: "Out of date", bundle: .module), tone: .warning)
        }
    }
}

#if DEBUG
    #Preview("Change card") { ChatChangeCardPreview(status: .pending) }
    #Preview("Change card · applied, dark") { ChatChangeCardPreview(status: .applied).preferredColorScheme(.dark) }
    #Preview("Change card · undo confirm") { ChatChangeCardPreview(status: .applied, confirming: true) }
    #Preview("Change card · AX3") { ChatChangeCardPreview(status: .pending).dynamicTypeSize(.accessibility3) }
#endif
