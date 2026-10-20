import Foundation
import KoboTokens
import SwiftUI

/// A read-only table: a header row, then one row per item. Numeric columns align trailing with tabular digits, an
/// emphasised cell is bold, and columns size to their widest cell (so they grow with Dynamic Type). A table wider than
/// its space scrolls sideways; at accessibility sizes each row stacks into "header value" lines instead. With
/// `onSelect`, rows are buttons. VoiceOver reads each row as one element ("Mar 4, Distance 12 km, Time 1:02").
///
///     KoboDataTable(
///         columns: [DataTableColumn("Date"), DataTableColumn("Distance", kind: .numeric)],
///         rows: [DataTableRow(id: "1", cells: ["Mar 4", DataTableCell("12.4 km", emphasized: true)])],
///         onSelect: { id in open(id) }
///     )
public struct KoboDataTable: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var widths: [Int: CGFloat] = [:]
    private let columns: [DataTableColumn]
    private let rows: [DataTableRow]
    private let onSelect: ((DataTableRow.ID) -> Void)?

    /// - Parameter onSelect: called with a row's id when it is tapped; rows are not tappable when `nil`.
    public init(columns: [DataTableColumn], rows: [DataTableRow], onSelect: ((DataTableRow.ID) -> Void)? = nil) {
        self.columns = columns
        self.rows = rows
        self.onSelect = onSelect
    }

    public var body: some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(rows) { row in
                    tappable(row) { stacked(row) }
                }
            }
        } else {
            ScrollView(.horizontal) {
                VStack(alignment: .leading, spacing: 0) {
                    header
                    ForEach(rows) { row in
                        tappable(row) { line(row) }
                    }
                }
                .collectsColumnWidths($widths)
            }
            .scrollBounceBehavior(.basedOnSize, axes: .horizontal)
        }
    }

    private var header: some View {
        HStack(spacing: Space.md) {
            ForEach(Array(columns.enumerated()), id: \.element.id) { index, column in
                Text(verbatim: column.title)
                    .font(theme.font(.caption).weight(.semibold))
                    .foregroundStyle(theme.palette.textSecondary)
                    .tableColumn(index, width: widths[index], alignment: alignment(of: column))
            }
        }
        .padding(.vertical, Space.xs)
        .accessibilityHidden(true)
    }

    private func line(_ row: DataTableRow) -> some View {
        HStack(spacing: Space.md) {
            ForEach(Array(columns.enumerated()), id: \.element.id) { index, column in
                cellText(row, index)
                    .font(cellFont(row, index, column))
                    .tableColumn(index, width: widths[index], alignment: alignment(of: column))
            }
        }
        .padding(.vertical, Space.sm)
        .frame(minHeight: Size.minTouch)
    }

    private func stacked(_ row: DataTableRow) -> some View {
        VStack(alignment: .leading, spacing: Space.xxs) {
            cellText(row, 0).font(theme.font(.headline))
            ForEach(Array(columns.enumerated().dropFirst()), id: \.element.id) { index, column in
                VStack(alignment: .leading, spacing: 0) {
                    Text(verbatim: column.title)
                        .font(theme.font(.caption))
                        .foregroundStyle(theme.palette.textSecondary)
                    cellText(row, index).font(cellFont(row, index, column))
                }
            }
        }
        .padding(.vertical, Space.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func tappable(_ row: DataTableRow, @ViewBuilder content: () -> some View) -> some View {
        let spoken = Text(verbatim: DataTableText.accessibilityText(columns: columns, row: row))
        if let onSelect {
            Button {
                onSelect(row.id)
            } label: {
                content().contentShape(Rectangle())
            }
            .buttonStyle(ListRowButtonStyle())
            .overlay(alignment: .bottom) { rule }
            .accessibilityLabel(spoken)
        } else {
            content()
                .overlay(alignment: .bottom) { rule }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(spoken)
        }
    }

    private var rule: some View {
        Rectangle().fill(theme.palette.separator).frame(height: Size.hairline).accessibilityHidden(true)
    }

    private func cellText(_ row: DataTableRow, _ index: Int) -> some View {
        let cell = index < row.cells.count ? row.cells[index] : DataTableCell("")
        return Text(verbatim: cell.text)
            .foregroundStyle(cell.isEmphasized || index == 0 ? theme.palette.textPrimary : theme.palette.textSecondary)
    }

    private func cellFont(_ row: DataTableRow, _ index: Int, _ column: DataTableColumn) -> Font {
        let emphasized = index < row.cells.count && row.cells[index].isEmphasized
        let base = column.kind == .numeric ? theme.font(.subheadline).monospacedDigit() : theme.font(.subheadline)
        return emphasized ? base.weight(.bold) : base
    }

    private func alignment(of column: DataTableColumn) -> Alignment {
        column.kind == .numeric ? .trailing : .leading
    }
}

private struct KoboDataTablePreview: View {
    @Environment(\.koboTheme) private var theme

    var body: some View {
        KoboDataTable(
            columns: [
                DataTableColumn("Date"), DataTableColumn("Place"), DataTableColumn("Distance", kind: .numeric),
                DataTableColumn("Time", kind: .numeric), DataTableColumn("Climb", kind: .numeric),
            ],
            rows: [
                DataTableRow(
                    id: "1",
                    cells: ["Oct 18", "River loop", DataTableCell("21.1 km", emphasized: true), "1:52:10", "140 m"]
                ),
                DataTableRow(id: "2", cells: ["Oct 15", "Park", "8.0 km", "41:05", "35 m"]),
                DataTableRow(
                    id: "3",
                    cells: ["Oct 12", "Hill road", "12.4 km", "1:08:44", DataTableCell("410 m", emphasized: true)]
                ),
            ],
            onSelect: { _ in }
        )
        .padding()
        .background(theme.palette.canvas)
    }
}

#if DEBUG
    #Preview("Data table") { KoboDataTablePreview() }
    #Preview("Data table, dark") { KoboDataTablePreview().preferredColorScheme(.dark) }
    #Preview("Data table, AX3") { KoboDataTablePreview().dynamicTypeSize(.accessibility3) }
#endif
