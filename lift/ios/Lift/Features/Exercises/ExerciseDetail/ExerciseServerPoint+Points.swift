import Foundation
import LiftSync

extension ExerciseServerPoint {
    /// The coach's points as chart points in the calendar, oldest first. A point whose day does not read is left out.
    static func points(_ points: [LiftE1RMPoint], days: DayCalendar) -> [ExerciseServerPoint] {
        points.compactMap { point in
            guard let day = CoachPlanDates.day(fromPlain: point.date), let date = days.date(of: day) else { return nil }
            return ExerciseServerPoint(date: date, e1rm: point.e1rm, sessionID: point.sessionId, label: point.label)
        }
    }

    /// The point nearest `date`, for a touch on the chart; nil when there are none.
    static func nearest(to date: Date, in points: [ExerciseServerPoint]) -> ExerciseServerPoint? {
        points.min { abs($0.date.timeIntervalSince(date)) < abs($1.date.timeIntervalSince(date)) }
    }
}
