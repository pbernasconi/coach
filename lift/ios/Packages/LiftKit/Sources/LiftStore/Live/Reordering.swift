import Foundation
import GRDB
import LiftCore

/// A synced row with a position under its parent.
protocol PositionedRecord: SyncedRecord {
    var position: Int { get set }
}

extension SessionExerciseRecord: PositionedRecord {}
extension TemplateExerciseRecord: PositionedRecord {}

/// Reorders the live children of one parent inside the caller's transaction.
enum Reordering {
    /// Hands the positions `rows` already hold to the rows in the order of `ids`, and writes only the rows that move.
    /// Reusing the same positions keeps them unique against removed rows. `ids` must hold every row once.
    static func apply<Record: PositionedRecord>(
        _ rows: [Record],
        ids: [UUID],
        store: StoreWriter,
        stamp: Date,
        _ db: Database
    ) throws {
        guard ids.count == rows.count, Set(ids) == Set(rows.map(\.id)) else {
            throw AppError(.invalidInput, detail: "reorder ids")
        }
        let positions = rows.map(\.position).sorted()
        let byID = Dictionary(rows.map { ($0.id, $0) }) { first, _ in first }
        for (index, id) in ids.enumerated() {
            guard var row = byID[id], row.position != positions[index] else { continue }
            row.position = positions[index]
            try store.updateRow(row, at: stamp, db)
        }
    }
}
