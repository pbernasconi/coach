import KoboComponents
import KoboTokens
import SwiftUI

/// A `ReviewSummary` on a card: the symbol disc, the figure and the caption under it (one VoiceOver element, read in
/// that order), a hairline and the note, then the edit link.
struct ReviewSummaryCard: View {
    @Environment(\.koboTheme) private var theme
    let summary: ReviewSummary

    var body: some View {
        VStack(spacing: Space.md) {
            VStack(spacing: Space.sm) {
                if let symbol = summary.symbol {
                    EmptyStateArt(systemImage: symbol, tone: .accent)
                }
                summary.value
                    .font(theme.font(.display))
                    .foregroundStyle(theme.palette.textPrimary)
                    .minimumScaleFactor(Self.minimumScale)
                if let caption = summary.caption {
                    caption
                        .font(theme.font(.subheadline))
                        .foregroundStyle(theme.palette.textSecondary)
                }
            }
            .accessibilityElement(children: .combine)
            if let note = summary.note {
                Separator()
                note
                    .font(theme.font(.footnote))
                    .foregroundStyle(theme.palette.textSecondary)
            }
            if let onEdit = summary.onEdit {
                Button(action: onEdit) { summary.editLabel }
                    .buttonStyle(.kobo(.plain, size: .compact))
            }
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .koboCard(padding: Space.xl)
    }

    /// How far a long figure may shrink before it wraps.
    private static let minimumScale: CGFloat = 0.6
}
