import Foundation

/// A column of a `KoboDataTable`: its header and how its cells line up. Numeric columns align trailing with tabular
/// digits, so values line up by place.
nonisolated public struct DataTableColumn: Identifiable, Equatable, Sendable {
    /// How a column's cells line up.
    public enum Kind: Equatable, Sendable {
        /// Words, aligned leading.
        case text
        /// Numbers, aligned trailing with tabular digits.
        case numeric
    }

    public let id: String
    public let title: String
    public let kind: Kind

    /// A column; `title` is shown as is and is also its id unless one is given.
    public init(_ title: String, kind: Kind = .text, id: String? = nil) {
        self.id = id ?? title
        self.title = title
        self.kind = kind
    }
}

/// A cell of a `KoboDataTable`: its text, shown as is, and whether it stands out (bold, in the primary ink).
nonisolated public struct DataTableCell: Equatable, Sendable, ExpressibleByStringLiteral {
    public let text: String
    public let isEmphasized: Bool

    public init(_ text: String, emphasized: Bool = false) {
        self.text = text
        self.isEmphasized = emphasized
    }

    public init(stringLiteral value: String) {
        self.init(value)
    }
}

/// A row of a `KoboDataTable`: one cell per column, in column order.
nonisolated public struct DataTableRow: Identifiable, Equatable, Sendable {
    public let id: String
    public let cells: [DataTableCell]

    public init(id: String, cells: [DataTableCell]) {
        self.id = id
        self.cells = cells
    }
}

/// Pure table text: what VoiceOver reads for a row.
nonisolated enum DataTableText {
    /// "Header, value" pairs for a row, the first cell alone (it names the row): "Mar 4, Distance 12 km, Time 1:02".
    /// Empty cells are skipped; missing cells count as empty.
    static func accessibilityText(columns: [DataTableColumn], row: DataTableRow) -> String {
        columns.indices.compactMap { index -> String? in
            guard index < row.cells.count else { return nil }
            let text = row.cells[index].text.trimmingCharacters(in: .whitespaces)
            guard !text.isEmpty else { return nil }
            return index == 0 ? text : "\(columns[index].title) \(text)"
        }
        .joined(separator: ", ")
    }
}
