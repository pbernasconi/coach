import KoboTokens
import SwiftUI

/// One row of a `ChangeSetCard`: the kind's glyph, the title (struck through when removed) and the detail.
struct ChangeItemRow: View {
    @Environment(\.koboTheme) private var theme
    @ScaledMetric(relativeTo: .body) private var glyph = Size.iconMd
    let item: ChangeItem
    let isQuiet: Bool

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: Space.sm) {
            Image(systemName: symbol)
                .foregroundStyle(isQuiet ? theme.palette.textTertiary : tint)
                .frame(width: glyph)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: Space.xxs) {
                Text(verbatim: item.title)
                    .font(theme.font(.subheadline).weight(.semibold))
                    .strikethrough(item.kind == .removed)
                    .foregroundStyle(isQuiet ? theme.palette.textSecondary : theme.palette.textPrimary)
                if let detail = item.detail {
                    Text(verbatim: detail)
                        .font(theme.font(.footnote))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(Text("\(kindLabel): \(item.title)", bundle: .module))
        .accessibilityValue(item.detail.map { Text(verbatim: $0) } ?? Text(verbatim: ""))
    }

    private var symbol: String {
        switch item.kind {
        case .added: "plus.circle.fill"
        case .removed: "minus.circle.fill"
        case .changed: "arrow.right.circle.fill"
        }
    }

    private var tint: Color {
        switch item.kind {
        case .added: theme.palette.success.ink
        case .removed: theme.palette.danger.ink
        case .changed: theme.palette.info.ink
        }
    }

    private var kindLabel: String {
        switch item.kind {
        case .added: String(localized: "Add", bundle: .module)
        case .removed: String(localized: "Remove", bundle: .module)
        case .changed: String(localized: "Change", bundle: .module)
        }
    }
}

/// The phase in words with a glyph, at the card's top trailing corner.
struct ChangeSetPhaseLabel: View {
    @Environment(\.koboTheme) private var theme
    let phase: ChangeSetPhase

    var body: some View {
        Label {
            label
        } icon: {
            Image(systemName: symbol)
        }
        .font(theme.font(.caption).weight(.semibold))
        .foregroundStyle(ink)
        .labelStyle(.titleAndIcon)
    }

    private var label: Text {
        switch phase {
        case .proposed, .applying: Text("Proposed", bundle: .module)
        case .applied: Text("Applied", bundle: .module)
        case .dismissed: Text("Dismissed", bundle: .module)
        case .outdated: Text("Out of date", bundle: .module)
        }
    }

    private var symbol: String {
        switch phase {
        case .proposed, .applying: "sparkles"
        case .applied: "checkmark.circle.fill"
        case .dismissed: "xmark.circle"
        case .outdated: "clock.arrow.circlepath"
        }
    }

    private var ink: Color {
        switch phase {
        case .proposed, .applying: theme.palette.accentText
        case .applied: theme.palette.success.ink
        case .dismissed: theme.palette.textSecondary
        case .outdated: theme.palette.warning.ink
        }
    }
}

#if DEBUG
    private struct ChangeSetCardPreview: View {
        @Environment(\.koboTheme) private var theme
        @State private var phase = ChangeSetPhase.proposed
        private let changes = [
            ChangeItem(.changed, title: "Team sync", detail: "Mon 17:00 → Tue 09:00"),
            ChangeItem(.removed, title: "Design review", detail: "Tue 09:00"),
            ChangeItem(.added, title: "Walk with a friend", detail: "Mon 16:00 · 45 min"),
        ]

        var body: some View {
            ScrollView {
                VStack(spacing: Space.lg) {
                    ChangeSetCard(
                        "Move the sync",
                        changes: changes,
                        phase: phase,
                        onApply: { phase = .applied },
                        onDismiss: { phase = .dismissed },
                        onUndo: { phase = .proposed }
                    ) {
                        Text(verbatim: "Based on your calendar for Monday and Tuesday")
                    }
                    ChangeSetCard(verbatim: "Applying", changes: changes, phase: .applying, onApply: {}, onDismiss: {})
                    ChangeSetCard(verbatim: "Outdated", changes: changes, phase: .outdated, onApply: {}, onDismiss: {})
                }
                .padding(Space.gutter)
            }
            .background(theme.palette.canvas)
        }
    }

    #Preview("ChangeSetCard") { ChangeSetCardPreview() }
    #Preview("ChangeSetCard · dark") { ChangeSetCardPreview().preferredColorScheme(.dark) }
    #Preview("ChangeSetCard · AX3") { ChangeSetCardPreview().dynamicTypeSize(.accessibility3) }
#endif
