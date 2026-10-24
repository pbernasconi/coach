import Foundation
import LiftCore

/// A change the phone made to a planned workout on the coach (lift/APP-API.md, "Move a workout", "Delete a workout"),
/// shown in the kept plan at once, before the next fetch brings the server's answer.
public enum CoachPlanEdit: Equatable, Sendable {
    /// The item goes to `day`.
    case move(id: String, to: LocalDay)
    /// The item is gone.
    case remove(id: String)

    /// The plan activity id it changes.
    public var id: String {
        switch self {
        case .move(let id, _), .remove(let id): id
        }
    }
}

extension CoachPlanBook {
    /// Shows `edit` in the kept weeks: the item leaves its day, and a move puts it last on its new day when that week
    /// is kept. The states stay as they were until the next fetch, which replaces these weeks.
    public mutating func apply(_ edit: CoachPlanEdit) {
        guard let moving = take(edit.id), case .move(_, let day) = edit else { return }
        var item = moving
        item.date = day
        place(item, on: day)
    }
}
