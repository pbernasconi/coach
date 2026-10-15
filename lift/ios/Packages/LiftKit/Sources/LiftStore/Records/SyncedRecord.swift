import Foundation
import GRDB

/// A row that syncs: it has a client-made id and the row stamps (DATA-2), and every write to it appends one
/// outbox entry (DATA-3).
protocol SyncedRecord: FetchableRecord, PersistableRecord, Sendable {
    static var entity: OutboxEntity { get }
    var id: UUID { get }
    var updatedAt: Date { get set }
    var deletedAt: Date? { get set }
}

extension Column {
    static let id = Column("id")
    static let deletedAt = Column("deletedAt")
    static let position = Column("position")
}
