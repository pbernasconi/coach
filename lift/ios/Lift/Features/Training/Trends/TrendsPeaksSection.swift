import KoboComponents
import KoboTokens
import SwiftUI

/// The best power and run efforts in one window (all time, 90 or 28 days). The all-time bests are bold; a row opens
/// the activity it came from.
struct TrendsPeaksSection: View {
    let peaks: TrendsPeaks
    let window: String
    let send: (TrainingAction) -> Void
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: Space.md) {
            if peaks.windows.count > 1 {
                SegmentedPicker(
                    "Peaks window",
                    selection: .action(window) { send(.peaksWindowChanged($0)) },
                    options: peaks.windows.map { ChoiceOption($0.key, verbatim: $0.label) }
                )
            }
            table(peaks.power)
            table(peaks.run)
            if let note = peaks.note {
                Text(verbatim: note).font(theme.font(.footnote)).foregroundStyle(theme.palette.textSecondary)
            }
        }
    }

    @ViewBuilder
    private func table(_ table: TrendsPeaks.Table) -> some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            Text(verbatim: "\(table.title) · \(table.unitText)").font(theme.font(.headline))
            if table.empty {
                SectionState("No data yet.")
            } else {
                KoboDataTable(
                    columns: [
                        DataTableColumn(String(localized: "Span")),
                        DataTableColumn(String(localized: "Best"), kind: .numeric),
                        DataTableColumn(String(localized: "Date")),
                        DataTableColumn(String(localized: "Activity")),
                    ],
                    rows: table.rows.compactMap { row(table, $0) },
                    onSelect: { id in
                        if let activity = activityID(in: table, rowID: id) { send(.activityTapped(activity)) }
                    }
                )
            }
        }
    }

    private func row(_ table: TrendsPeaks.Table, _ row: TrendsPeaks.Row) -> DataTableRow? {
        let cell = row.cells[window] ?? nil
        let best = cell.map { [$0.text, $0.subText].compactMap(\.self).filter { !$0.isEmpty } }
        let bestText = (best?.first == best?.last ? best?.first : best?.joined(separator: " · ")) ?? "–"
        return DataTableRow(
            id: "\(table.title)-\(row.label)",
            cells: [
                DataTableCell(row.label),
                DataTableCell(bestText, emphasized: cell?.best ?? false),
                DataTableCell(cell?.dateText ?? "–"),
                DataTableCell(cell?.name ?? ""),
            ]
        )
    }

    private func activityID(in table: TrendsPeaks.Table, rowID: String) -> String? {
        let row = table.rows.first { "\(table.title)-\($0.label)" == rowID }
        return (row?.cells[window] ?? nil)?.activityId
    }
}
