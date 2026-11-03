import Foundation

/// One planning action for `PUT api/app/plan/week` (lift/APP-API.md, "Weekly planning").
nonisolated struct PlannerRequest: Encodable, Equatable, Sendable {
    let action: String
    var weekStart: String?
    var proposalId: String?
    var answers: PlannerAnswers?
    var note: String?
    var op: SessionOp?

    /// A change to one session of the draft: `move` (date, time), `length` (minutes) or `remove`.
    struct SessionOp: Encodable, Equatable, Sendable {
        let kind: String
        let index: Int
        var date: String?
        var time: String?
        var minutes: Int?
    }

    static func draft(_ week: String, _ answers: PlannerAnswers) -> Self {
        PlannerRequest(action: "draft", weekStart: week, answers: answers)
    }

    static func revise(_ id: String, _ note: String) -> Self {
        PlannerRequest(action: "revise", proposalId: id, note: note)
    }

    static func undo(_ id: String) -> Self { PlannerRequest(action: "undo", proposalId: id) }

    static func accept(_ id: String) -> Self { PlannerRequest(action: "accept", proposalId: id) }

    static func edit(_ id: String, _ op: SessionOp) -> Self { PlannerRequest(action: "edit", proposalId: id, op: op) }
}
