import Foundation
import LiftCore
import LiftStore

/// One session as a list shows it: its title, day and set counts. Built from a `SessionDetail`.
nonisolated struct SessionSummary: Equatable, Sendable, Identifiable {
    let id: UUID
    let day: LocalDay
    let title: String
    let exerciseCount: Int
    /// Sets marked done.
    let loggedSets: Int
    let totalSets: Int
    /// Finished, or every set is done or skipped.
    let isDone: Bool
    /// The first line of the session's note ("Short on time, no lunges"), or nil.
    let note: String?
    /// The template the session was planned from, if any.
    let templateID: UUID?
    /// When this phone last moved the session to another day (schema v8), or nil.
    let dayMovedAt: Date?

    init(
        id: UUID,
        day: LocalDay,
        title: String,
        exerciseCount: Int,
        loggedSets: Int,
        totalSets: Int,
        isDone: Bool,
        note: String? = nil,
        templateID: UUID? = nil,
        dayMovedAt: Date? = nil
    ) {
        self.id = id
        self.day = day
        self.title = title
        self.exerciseCount = exerciseCount
        self.loggedSets = loggedSets
        self.totalSets = totalSets
        self.isDone = isDone
        self.note = note
        self.templateID = templateID
        self.dayMovedAt = dayMovedAt
    }

    init(detail: SessionDetail) {
        let sets = detail.items.flatMap(\.sets)
        let allHandled = !sets.isEmpty && sets.allSatisfy { $0.status != .planned }
        self.init(
            id: detail.id,
            day: detail.session.day,
            title: detail.session.title,
            exerciseCount: detail.items.count,
            loggedSets: sets.count(where: { $0.status == .done }),
            totalSets: sets.count,
            isDone: detail.session.finishedAt != nil || allHandled,
            note: SessionText.notePreview(detail.session.note),
            templateID: detail.session.templateID,
            dayMovedAt: detail.session.dayMovedAt
        )
    }

    /// Something was logged: the session belongs in history even if it is today.
    var hasLoggedSets: Bool { loggedSets > 0 }
}
