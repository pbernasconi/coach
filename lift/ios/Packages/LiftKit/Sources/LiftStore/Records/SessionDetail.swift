import Foundation
import LiftCore

/// A live session with its live exercises and sets, in position order. Soft-deleted rows are left out.
public struct SessionDetail: Hashable, Sendable, Identifiable {
    public struct Item: Hashable, Sendable, Identifiable {
        public var exercise: SessionExerciseRecord
        public var sets: [SetRecord]

        public var id: UUID { exercise.id }

        public init(exercise: SessionExerciseRecord, sets: [SetRecord]) {
            self.exercise = exercise
            self.sets = sets
        }
    }

    public var session: SessionRecord
    public var items: [Item]

    public var id: UUID { session.id }

    public init(session: SessionRecord, items: [Item]) {
        self.session = session
        self.items = items
    }

    /// The LiftCore view, for the rules (`WeekPlan`, `Progression`, `WeeklyVolume`).
    public var domain: Session {
        Session(
            id: session.id,
            date: session.day,
            title: session.title,
            templateID: session.templateID,
            exercises: items.map(\.domain),
            startedAt: session.startedAt,
            finishedAt: session.finishedAt,
            warmUpNote: session.warmUpNote,
            note: session.note,
            unitsAtLog: session.unitsAtLog,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            deletedAt: session.deletedAt
        )
    }
}

extension SessionDetail.Item {
    var domain: SessionExercise {
        SessionExercise(
            id: exercise.id,
            exerciseID: exercise.exerciseID,
            displayName: exercise.displayName,
            loadMode: exercise.loadMode,
            equipment: exercise.equipment,
            sets: sets.map(\.loggedSet),
            restSeconds: exercise.restSeconds,
            note: exercise.note,
            supersetGroup: exercise.supersetGroup,
            nextTimeHint: exercise.nextTimeHint
        )
    }
}
