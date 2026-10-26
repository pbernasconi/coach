import KoboTokens
import SwiftUI

/// A set of changes an assistant proposes, shown before anything is written: one row per change (added, removed,
/// changed, each with its glyph), a context slot for what the proposal is based on, and at most two buttons. A
/// proposal has a dashed accent rim; once applied it shows a check and a named Undo; dismissed and outdated proposals
/// go quiet. Nothing changes until the reader taps Apply.
///
///     ChangeSetCard("Move dinner", changes: items, phase: phase, onApply: apply, onDismiss: dismiss, onUndo: undo) {
///         Text("Based on your calendar for Friday")
///     }
public struct ChangeSetCard<Context: View>: View {
    @Environment(\.koboTheme) private var theme
    private let title: Text
    private let changes: [ChangeItem]
    private let phase: ChangeSetPhase
    private let onApply: () -> Void
    private let onDismiss: () -> Void
    private let onUndo: (() -> Void)?
    private let context: Context

    /// A card with a localized title.
    public init(
        _ title: LocalizedStringKey,
        changes: [ChangeItem],
        phase: ChangeSetPhase,
        onApply: @escaping () -> Void,
        onDismiss: @escaping () -> Void,
        onUndo: (() -> Void)? = nil,
        @ViewBuilder context: () -> Context
    ) {
        self.init(
            title: Text(title),
            changes: changes,
            phase: phase,
            onApply: onApply,
            onDismiss: onDismiss,
            onUndo: onUndo,
            context: context()
        )
    }

    /// A card whose title is shown as is (written by the model or the server).
    public init(
        verbatim title: String,
        changes: [ChangeItem],
        phase: ChangeSetPhase,
        onApply: @escaping () -> Void,
        onDismiss: @escaping () -> Void,
        onUndo: (() -> Void)? = nil,
        @ViewBuilder context: () -> Context
    ) {
        self.init(
            title: Text(verbatim: title),
            changes: changes,
            phase: phase,
            onApply: onApply,
            onDismiss: onDismiss,
            onUndo: onUndo,
            context: context()
        )
    }

    private init(
        title: Text,
        changes: [ChangeItem],
        phase: ChangeSetPhase,
        onApply: @escaping () -> Void,
        onDismiss: @escaping () -> Void,
        onUndo: (() -> Void)?,
        context: Context
    ) {
        self.title = title
        self.changes = changes
        self.phase = phase
        self.onApply = onApply
        self.onDismiss = onDismiss
        self.onUndo = onUndo
        self.context = context
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
                title.font(theme.font(.headline)).foregroundStyle(theme.palette.textPrimary)
                Spacer(minLength: Space.sm)
                ChangeSetPhaseLabel(phase: phase)
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            VStack(alignment: .leading, spacing: Space.sm) {
                ForEach(changes) { ChangeItemRow(item: $0, isQuiet: isQuiet) }
            }
            context
                .font(theme.font(.footnote))
                .foregroundStyle(theme.palette.textSecondary)
            buttons
        }
        .padding(Space.cardInset)
        .background(theme.palette.surface, in: shape)
        .overlay {
            if phase == .proposed || phase == .applying {
                shape.strokeBorder(
                    theme.palette.accent,
                    style: StrokeStyle(lineWidth: ChatMetrics.proposalRimWidth, dash: ChatMetrics.proposalDash)
                )
            }
        }
        .koboAnimation(.state, value: phase)
        .koboFeedback(trigger: phase) { _, new in new == .applied ? .success : nil }
    }

    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: Radius.lg, style: .continuous) }
    private var isQuiet: Bool { phase == .dismissed || phase == .outdated }

    @ViewBuilder private var buttons: some View {
        let actions = phase.actions(canUndo: onUndo != nil)
        if !actions.isEmpty {
            HStack(spacing: Space.sm) {
                ForEach(actions, id: \.self) { action in  // ios-guard: allow fieldless enum, the value is its id
                    switch action {
                    case .dismiss:
                        Button(action: onDismiss) { Text("Dismiss", bundle: .module) }
                            .buttonStyle(.kobo(.secondary, width: .full))
                            .disabled(phase == .applying)
                    case .apply:
                        Button(action: onApply) { Text("Apply", bundle: .module) }
                            .buttonStyle(.kobo(.primary, width: .full, isLoading: phase == .applying))
                    case .undo:
                        Button {
                            onUndo?()
                        } label: {
                            Text("Undo \(changes.count) changes", bundle: .module)
                        }
                        .buttonStyle(.kobo(.secondary, width: .full))
                    }
                }
            }
        }
    }
}

extension ChangeSetCard where Context == EmptyView {
    /// A card with no context line.
    public init(
        verbatim title: String,
        changes: [ChangeItem],
        phase: ChangeSetPhase,
        onApply: @escaping () -> Void,
        onDismiss: @escaping () -> Void,
        onUndo: (() -> Void)? = nil
    ) {
        self.init(
            verbatim: title,
            changes: changes,
            phase: phase,
            onApply: onApply,
            onDismiss: onDismiss,
            onUndo: onUndo
        ) { EmptyView() }
    }
}
