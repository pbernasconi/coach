import KoboComponents
import KoboTokens
import SwiftUI

/// Per-kilometre splits.
struct ActivitySplitsTable: View {
    let splits: ActivitySplits

    var body: some View {
        TableWithNote(note: splits.note) {
            KoboDataTable(
                columns: columns(["Km", "Pace", "GAP", "Elev", "HR"], numericFrom: 1),
                rows: splits.rows.map { row in
                    DataTableRow(
                        id: "\(row.index)",
                        cells: [
                            DataTableCell(row.label), DataTableCell(row.paceText, emphasized: true),
                            DataTableCell(row.gapText ?? "–"), DataTableCell(row.elevText), DataTableCell(row.hrText),
                        ]
                    )
                }
            )
        }
    }
}

/// Laps; the GAP and power columns only when the server says the activity has them.
struct ActivityLapsTable: View {
    let laps: ActivityLaps

    var body: some View {
        let gap: [String.LocalizationValue] = laps.hasGap ? ["GAP"] : []
        let power: [String.LocalizationValue] = laps.hasPower ? ["Power"] : []
        let titles: [String.LocalizationValue] = ["Lap", "Distance", "Time", "Pace"] + gap + ["Elev", "HR"] + power
        KoboDataTable(
            columns: columns(titles, numericFrom: 1),
            rows: laps.rows.map { row in
                let cells =
                    [row.name, row.distanceText, row.timeText, row.paceText] + (laps.hasGap ? [row.gapText] : [])
                    + [row.elevText, row.hrText] + (laps.hasPower ? [row.powerText] : [])
                return DataTableRow(id: "\(row.index)", cells: cells.map { DataTableCell($0) })
            }
        )
    }
}

/// Strava's best efforts; a PR is bold.
struct ActivityBestEffortsTable: View {
    let efforts: ActivityBestEfforts

    var body: some View {
        TableWithNote(note: efforts.note) {
            KoboDataTable(
                columns: columns(["Effort", "Time", "Pace", "Rank"], numericFrom: 1),
                rows: efforts.rows.map { row in
                    DataTableRow(
                        id: row.label,
                        cells: [
                            DataTableCell(row.label), DataTableCell(row.timeText, emphasized: row.prRank == 1),
                            DataTableCell(row.paceText), DataTableCell(row.rankText),
                        ]
                    )
                }
            )
        }
    }
}

/// The top segments, PRs and top-10 ranks first.
struct ActivitySegmentsTable: View {
    let segments: ActivitySegments

    var body: some View {
        TableWithNote(note: segments.note) {
            KoboDataTable(
                columns: columns(["Segment", "Distance", "Grade", "Time", "Pace", "HR", "Rank"], numericFrom: 1),
                rows: segments.rows.map { row in
                    DataTableRow(
                        id: row.id,
                        cells: [
                            DataTableCell(row.name), DataTableCell(row.distanceText), DataTableCell(row.gradeText),
                            DataTableCell(row.timeText, emphasized: row.prRank == 1 || row.komRank != nil),
                            DataTableCell(row.paceText), DataTableCell(row.hrText), DataTableCell(row.rankText),
                        ]
                    )
                }
            )
        }
    }
}

/// Other activities on this route, fastest first; this activity is shown but not a link.
struct ActivitySameRouteView: View {
    let sameRoute: ActivitySameRoute
    let send: (ActivityDetailAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            SectionHeader(verbatim: sameRoute.title, subtitle: sameRoute.note)
            KoboDataTable(
                columns: columns(["Day", "Name", "Distance", "Time", "Pace"], numericFrom: 2),
                rows: sameRoute.rows.map { row in
                    DataTableRow(
                        id: row.activityId,
                        cells: [
                            DataTableCell(row.day, emphasized: row.isThis),
                            DataTableCell(row.name, emphasized: row.isThis),
                            DataTableCell(row.distanceText), DataTableCell(row.timeText), DataTableCell(row.paceText),
                        ]
                    )
                },
                onSelect: { id in
                    if sameRoute.rows.contains(where: { $0.activityId == id && !$0.isThis }) {
                        send(.activityTapped(id))
                    }
                }
            )
        }
    }
}

/// A table with the server's note under it.
private struct TableWithNote<Table: View>: View {
    let note: String?
    @ViewBuilder let table: () -> Table
    @Environment(\.koboTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: Space.xs) {
            table()
            if let note {
                Text(verbatim: note).font(theme.font(.footnote)).foregroundStyle(theme.palette.textSecondary)
            }
        }
    }
}

/// Columns from localized titles; the ones from `numericFrom` on are numeric (right-aligned, tabular digits).
private func columns(_ titles: [String.LocalizationValue], numericFrom: Int) -> [DataTableColumn] {
    titles.enumerated().map { index, title in
        DataTableColumn(String(localized: title), kind: index >= numericFrom ? .numeric : .text)
    }
}
