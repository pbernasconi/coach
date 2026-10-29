import KoboComponents
import KoboTokens
import SwiftUI

/// Training time by sport in a reply (Kobo `ChatBreakdownCard`): the caption, the total, a bar per sport in its colour,
/// then Open (the card's page) and Share (the card as text).
struct CoachBreakdownView: View {
    @Environment(\.koboTheme) private var theme
    let breakdown: CoachBreakdown
    let onOpen: () -> Void

    var body: some View {
        ChatBreakdownCard(
            caption: breakdown.caption,
            total: breakdown.total,
            unit: breakdown.unit,
            rows: breakdown.rows.enumerated().map { index, row in
                ChatBreakdownRow(
                    id: "\(index)",
                    label: row.label,
                    value: row.value,
                    display: row.display,
                    tint: tint(row.tint)
                )
            }
        ) {
            HStack(spacing: Space.sm) {
                Button(action: onOpen) {
                    Label(openTitle, systemImage: "calendar")
                }
                .buttonStyle(.kobo(.outlined, size: .compact, width: .full))
                ShareLink(item: breakdown.shareText) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(.kobo(.outlined, size: .compact, width: .full))
            }
        }
    }

    private var openTitle: LocalizedStringKey {
        switch breakdown.link {
        case "lift": "Open in Lift"
        case "health": "Open in Today"
        default: "Open in Plan"
        }
    }

    /// The sport's colour, as the Week tab draws it; "accent" is Coach's orange.
    private func tint(_ name: String?) -> Color {
        if name == "accent" { return theme.palette.accent }
        return (Sport(rawValue: name ?? "other") ?? .other).color
    }
}
