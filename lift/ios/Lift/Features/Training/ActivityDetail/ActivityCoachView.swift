import KoboComponents
import KoboTokens
import SwiftUI

/// The coach's view: the plan workout this activity completed and how closely, its load, and Garmin's night.
struct ActivityCoachView: View {
    let coach: ActivityCoach
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            planned
            ListSection(verbatim: String(localized: "Load")) {
                KeyValueRow(verbatim: "TSS", value: coach.load.tssText)
                if let method = coach.load.methodText {
                    KeyValueRow(verbatim: String(localized: "TSS method"), value: method)
                }
                ForEach(coach.load.rows, id: \.key) { row in KeyValueRow(verbatim: row.label, value: row.valueText) }
                if let empty = coach.load.emptyText { ListRow(verbatim: empty) }
            }
            ListSection(verbatim: String(localized: "Garmin")) {
                ForEach(coach.garmin.rows, id: \.key) { row in KeyValueRow(verbatim: row.label, value: row.valueText) }
                if let empty = coach.garmin.emptyText { ListRow(verbatim: empty) }
            }
        }
    }

    @ViewBuilder private var planned: some View {
        if let planned = coach.planned {
            VStack(alignment: .leading, spacing: Space.xs) {
                HStack(alignment: .firstTextBaseline) {
                    Text(verbatim: planned.title).font(theme.font(.headline))
                    Spacer(minLength: Space.sm)
                    StatusPill(verbatim: planned.compliance.label, tone: tone(planned.compliance.level))
                }
                Text(verbatim: [planned.plannedText, planned.ratioText].compactMap(\.self).joined(separator: " · "))
                    .font(theme.font(.subheadline))
                    .foregroundStyle(theme.palette.textSecondary)
            }
            .padding(Space.cardInset)
            .koboCard()
        } else if let empty = coach.plannedEmptyText {
            SectionState(verbatim: empty)
        }
    }

    /// The web's compliance colours: good and done green, partial amber, off red, the rest grey.
    private func tone(_ level: String) -> Tone {
        switch level {
        case "good", "done": .success
        case "partial": .warning
        case "off", "missed": .danger
        default: .neutral
        }
    }
}
