import KoboTokens
import SwiftUI

/// Changes an assistant proposes, shown as they will be: a title and summary, then sections (usually days), each row
/// with a small glyph, its caption and one quiet tag ("From Sat", "Skipped", "New"). Under them the warnings and an
/// optional check line ("Checked against your plan"), each one short line with a toned glyph, and small Not now /
/// Apply N changes buttons at the trailing edge. After Apply the card says so, with Undo on the summary line; `result`
/// lines say what didn't go as shown. When Undo can put back only part, `undoConfirm` asks first. Calm on purpose and
/// dense, so a week of changes fits one screen: no boxed notices, no struck-through text, no coloured change glyphs,
/// one filled button.
/// A single section whose heading the summary already says ("2 changes · Sun 22 Nov") drops the heading.
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
            VStack(alignment: .leading, spacing: Space.md) {
                ForEach(sections) {
                    ChatChangeSectionView(section: $0, showsTitle: !hidesSectionTitle, dimmed: !status.isCurrent)
                }
            }
            if !notes.isEmpty || !result.isEmpty || showsChecked {
                VStack(alignment: .leading, spacing: Space.xs) {
                    ForEach(Array(notes.enumerated()), id: \.offset) { _, note in
                        ChatChangeNote(text: note, tone: .warning)
                    }
                    ForEach(Array(result.enumerated()), id: \.offset) { _, line in
                        ChatChangeNote(text: line, tone: status == .expired ? .warning : .info)
                    }
                    if showsChecked, let checked {
                        ChatChangeNote(text: checked, tone: .success)
                    }
                }
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

    private var showsChecked: Bool { status == .pending && checked != nil }
    private var hidesSectionTitle: Bool { sections.headingRepeats(summary: summary) }
    /// Undo sits on the summary line once applied, so the applied card spends no row on it.
    private var inlineUndo: (() -> Void)? { status == .applied && undoConfirm == nil ? actions.undo : nil }

    private var header: some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                Text(verbatim: title)
                    .font(theme.font(.subheadline).weight(.semibold))
                    .foregroundStyle(theme.palette.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                ChatChangeStatusPill(status: status)
            }
            if summary != nil || inlineUndo != nil {
                HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                    if let summary {
                        Text(verbatim: summary)
                            .font(theme.font(.footnote))
                            .foregroundStyle(theme.palette.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        Spacer(minLength: 0)
                    }
                    if let undo = inlineUndo { ChatChangeUndoButton(action: undo) }
                }
            }
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

/// A day: a small plain label, then its rows close under it. No rules or capitals, so a week of changes stays short.
private struct ChatChangeSectionView: View {
    @Environment(\.koboTheme) private var theme
    let section: ChatChangeSection
    let showsTitle: Bool
    let dimmed: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            if showsTitle {
                Text(verbatim: section.title)
                    .font(theme.font(.caption).weight(.semibold))
                    .foregroundStyle(theme.palette.textSecondary)
                    .accessibilityAddTraits(.isHeader)
            }
            VStack(alignment: .leading, spacing: Space.sm) {
                ForEach(section.rows) { ChatChangeRowView(row: $0) }
            }
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
