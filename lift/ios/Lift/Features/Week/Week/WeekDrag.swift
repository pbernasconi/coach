import Foundation
import LiftCore
import LiftSync
import SwiftUI

/// What a dragged Week row carries: a coach plan item or a Lift session, and the day it is on. It travels as plain text
/// ("plan|2026-10-23|<id>"), so the drag needs no custom type. Done workouts are never dragged.
nonisolated enum WeekDrag: Equatable, Sendable {
    case plan(id: String, from: LocalDay)
    case session(UUID, from: LocalDay)

    /// The drag of a row shown on `day`, or nil when it cannot move: done, an activity no plan matched, or a rest day.
    init?(_ entry: WeekEntry, on day: LocalDay) {
        switch entry {
        case .session(let session):
            guard !session.isDone else { return nil }
            self = .session(session.id, from: day)
        case .plan(let item):
            guard item.canMove else { return nil }
            self = .plan(id: item.id, from: day)
        }
    }

    init?(text: String) {
        let parts = text.split(separator: "|", maxSplits: 2).map(String.init)
        guard parts.count == 3, let day = CoachPlanDates.day(fromPlain: parts[1]) else { return nil }
        switch parts[0] {
        case "plan": self = .plan(id: parts[2], from: day)
        case "session":
            guard let id = UUID(uuidString: parts[2]) else { return nil }
            self = .session(id, from: day)
        default: return nil
        }
    }

    var text: String {
        switch self {
        case .plan(let id, let day): "plan|\(CoachPlanDates.plain(day))|\(id)"
        case .session(let id, let day): "session|\(CoachPlanDates.plain(day))|\(id.uuidString)"
        }
    }

    /// The Lift session it moves, so a double drop writes once; nil for a plan item.
    var sessionID: UUID? {
        guard case .session(let id, _) = self else { return nil }
        return id
    }

    var from: LocalDay {
        switch self {
        case .plan(_, let day), .session(_, let day): day
        }
    }
}

extension View {
    /// A long press lifts the row, to drop it on another day (`weekDropTarget`). Nothing when `drag` is nil.
    @ViewBuilder
    func weekDraggable(_ drag: WeekDrag?) -> some View {
        if let drag {
            draggable(drag.text)
        } else {
            self
        }
    }

    /// The day takes a dropped row: it moves there. `isTargeted` says when a row is held over the day.
    func weekDropTarget(
        _ day: LocalDay,
        isTargeted: @escaping (Bool) -> Void,
        send: @escaping (WeekAction) -> Void
    ) -> some View {
        dropDestination(for: String.self) { texts, _ in
            guard let drag = texts.first.flatMap(WeekDrag.init(text:)), drag.from != day else { return false }
            send(.rowDropped(drag, on: day))
            return true
        } isTargeted: {
            isTargeted($0)
        }
    }
}
