import Foundation
import LiftSync

/// A card Coach shows inside a reply (lift/APP-API.md, "Coach"): the server fills it with real data, so Coach never
/// writes a number. Each kind reuses the body of the route the app already reads: a Week API item or week, a Lift
/// session's exercise with its stats, the Today API's header and fitness, and a day's calendar blocks.
nonisolated enum CoachAttachment: Decodable, Equatable, Sendable {
    case workout(CoachItem)
    case week(CoachWeek)
    case exercise(CoachExerciseData)
    case readiness(CoachReadinessData)
    case day(CoachDayData)
    /// Training time by sport over a week or a month (flat in the card's JSON).
    case breakdown(CoachBreakdown)
    /// A kind this build does not know: skipped, so a newer server never breaks an older app.
    case unknown

    private enum CodingKeys: String, CodingKey { case kind, workout, week, exercise, readiness, day }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decodeIfPresent(String.self, forKey: .kind) {
        case "workout": self = .workout(try container.decode(CoachItem.self, forKey: .workout))
        case "week": self = .week(try container.decode(CoachWeek.self, forKey: .week))
        case "exercise": self = .exercise(try container.decode(CoachExerciseData.self, forKey: .exercise))
        case "readiness": self = .readiness(try container.decode(CoachReadinessData.self, forKey: .readiness))
        case "day": self = .day(try container.decode(CoachDayData.self, forKey: .day))
        case "breakdown": self = .breakdown(try CoachBreakdown(from: decoder))
        default: self = .unknown
        }
    }

    /// The attachments of a message; one that does not decode is dropped and the rest stay.
    static func list(from decoder: any Decoder) -> [CoachAttachment] {
        guard var list = try? decoder.unkeyedContainer() else { return [] }
        var result: [CoachAttachment] = []
        while !list.isAtEnd {
            if let attachment = try? list.decode(CoachAttachment.self), attachment != .unknown {
                result.append(attachment)
            } else {
                _ = try? list.decode(Skip.self)
            }
        }
        return result
    }

    /// Consumes one element of any shape.
    private struct Skip: Decodable {}
}

/// One exercise: the Lift session's exercise entry (picture, muscles, sets, last time, steps) and its stats, each
/// nil when the server has none; the name is always there.
nonisolated struct CoachExerciseData: Decodable, Equatable, Sendable {
    var name: String
    var exerciseKey: String?
    var sessionId: String?
    var item: LiftSessionExercise?
    var stats: LiftExerciseStats?
}

/// Readiness: the Today API's header chips (readiness, sleep, HRV, fitness, form), its cue, and the fitness days.
nonisolated struct CoachReadinessData: Decodable, Equatable, Sendable {
    var date: String
    var header: TodayHeader?
    var cue: String?
    var fitness: TodayFitness?
}

/// A day as calendar blocks between 06:00 and 22:00 in the athlete's zone.
nonisolated struct CoachDayData: Decodable, Equatable, Sendable {
    var date: String
    var title: String
    /// All-day events ("Travel to Zurich"); missing in older bodies.
    var allDay: [String]? = nil
    var blocks: [Block]

    nonisolated struct Block: Decodable, Equatable, Sendable {
        var start: String
        var end: String
        /// `busy`, `free` or `session`.
        var kind: String
        var title: String?
        var workoutId: String?
    }
}

/// Training time by sport over a week or a month: the caption ("October 2026"), the total ("14 h 20 m"), and a row per
/// sport, biggest first. `value` is minutes (a bar is value / max); `tint` names the sport's colour.
nonisolated struct CoachBreakdown: Decodable, Equatable, Sendable {
    var caption: String
    var title: String?
    var total: String
    var unit: String?
    var rows: [Row]
    /// Where Open goes: "plan" (the Week tab), "lift" or "health".
    var link: String?

    nonisolated struct Row: Decodable, Equatable, Sendable {
        var label: String
        var value: Double
        var display: String
        /// `run`, `ride`, `swim`, `strength`, `walk`, `other` or `accent`; missing reads as other.
        var tint: String?
    }

    /// The card as text, for Share.
    var shareText: String {
        ([caption + (title.map { " · \($0)" } ?? ""), total] + rows.map { "\($0.label): \($0.display)" })
            .joined(separator: "\n")
    }
}
