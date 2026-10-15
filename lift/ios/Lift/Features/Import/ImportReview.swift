import Foundation
import LiftCore

/// What the review step shows: the parsed workouts grouped by day, and the lines that were not imported.
nonisolated struct ImportReview: Equatable, Sendable {
    /// Oldest day first, the order notes are usually written in.
    var days: [ImportReviewDay]
    /// Lines the importer could not turn into data, in line order.
    var issues: [ImportIssue]

    var candidates: [ImportCandidate] { days.flatMap(\.sessions) }

    /// The workouts that will be written.
    var included: [ImportCandidate] { candidates.filter(\.isIncluded) }

    /// Sets in the included workouts.
    var includedSetCount: Int { included.reduce(0) { $0 + $1.setCount } }

    /// Names in the included workouts that match no library exercise, once each (by normalized name), in
    /// reading order. Importing creates each as a library exercise.
    var newExercises: [ImportNewExercise] {
        var seen: Set<String> = []
        var found: [ImportNewExercise] = []
        for name in included.flatMap(\.newExerciseNames) {
            let key = ExerciseMatcher.normalizedName(name)
            if seen.insert(key).inserted { found.append(ImportNewExercise(id: key, name: name)) }
        }
        return found
    }

    /// Includes or excludes one workout.
    mutating func toggle(_ id: UUID) {
        for day in days.indices {
            for index in days[day].sessions.indices where days[day].sessions[index].id == id {
                days[day].sessions[index].isIncluded.toggle()
            }
        }
    }
}

/// A written name that matches no library exercise.
nonisolated struct ImportNewExercise: Equatable, Sendable, Identifiable {
    /// The normalized name, which is how names are told apart.
    var id: String
    /// The name as first written.
    var name: String
}

/// The workouts parsed for one day.
nonisolated struct ImportReviewDay: Equatable, Sendable, Identifiable {
    var id: LocalDay
    /// "Tue 6 Oct".
    var title: String
    var sessions: [ImportCandidate]
}

/// One parsed workout and whether it will be written.
nonisolated struct ImportCandidate: Equatable, Sendable, Identifiable {
    var session: Session
    var isIncluded: Bool
    /// A workout with the same title already exists on that day, so it was probably imported before.
    var isDuplicate: Bool

    var id: UUID { session.id }
    var exerciseCount: Int { session.exercises.count }
    var setCount: Int { session.allSets.count }
    var loggedSetCount: Int { session.allSets.filter(\.isDone).count }

    /// Written names that match no library exercise.
    var newExerciseNames: [String] { session.exercises.filter { $0.exerciseID == nil }.map(\.displayName) }
}

/// Builds the review from the importer's result and the workouts already in the database.
nonisolated enum ImportReviewBuilder {
    /// A day and a title compared without case or surrounding spaces.
    struct SessionKey: Hashable, Sendable {
        let day: LocalDay
        let title: String

        init(day: LocalDay, title: String) {
            self.day = day
            self.title = title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        }
    }

    /// Duplicates of `existing` are excluded by default; everything else is included.
    static func review(of result: NotesImport, existing: [SessionKey], days: DayCalendar) -> ImportReview {
        let known = Set(existing)
        let candidates = result.sessions.map { session in
            let isDuplicate = known.contains(SessionKey(day: session.date, title: session.title))
            return ImportCandidate(session: session, isIncluded: !isDuplicate, isDuplicate: isDuplicate)
        }
        var grouped: [ImportReviewDay] = []
        for candidate in candidates.sorted(by: { $0.session.date < $1.session.date }) {
            let day = candidate.session.date
            if grouped.last?.id == day {
                grouped[grouped.count - 1].sessions.append(candidate)
            } else {
                grouped.append(ImportReviewDay(id: day, title: days.longTitle(of: day), sessions: [candidate]))
            }
        }
        return ImportReview(days: grouped, issues: result.issues)
    }

    /// The days the parsed workouts span, to look up what already exists; nil when nothing was parsed.
    static func dayRange(of result: NotesImport) -> ClosedRange<LocalDay>? {
        let dates = result.sessions.map(\.date)
        guard let first = dates.min(), let last = dates.max() else { return nil }
        return first...last
    }

    /// Ids for parsed workouts: review keys only (the repositories make the stored ids), so a counter is enough
    /// and keeps tests deterministic.
    static func localIDs() -> () -> UUID {
        var next: UInt64 = 0
        return {
            next += 1
            let b = withUnsafeBytes(of: next.bigEndian) { Array($0) }
            return UUID(uuid: (0x1D, 0x9A, 0, 0, 0, 0, 0x40, 0, 0x80, 0, b[2], b[3], b[4], b[5], b[6], b[7]))
        }
    }
}
