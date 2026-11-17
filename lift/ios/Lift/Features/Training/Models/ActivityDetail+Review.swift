import Foundation
import LiftSync

/// The workout review (lift/APP-API.md, "Workout review"): the planned workout against what was done, step by step,
/// with a score, the hard reps of each set, and the coach's words from Claude. Only for a run or ride done against a
/// structured plan; the server sends `null` otherwise.
nonisolated struct ActivityReview: Decodable, Equatable, Sendable {
    nonisolated struct Step: Decodable, Equatable, Sendable {
        var index: Int
        /// "Warm-up", "Rep 2/5", "Easy 2/5".
        var label: String
        /// `warmup | work | recovery | cooldown | steady`.
        var kind: String
        /// "Z1"…"Z5".
        var zone: String?
        var inRepeat: Bool
        /// "3:00 · Hard".
        var plannedText: String
        /// "2:59 · 5:41/km", or "Not done".
        var doneText: String
        /// "153 · max 158", or "–".
        var hrText: String
        /// "82 % in target", for a work step with a target.
        var inTargetText: String?
        /// `hit | close | easy | hard | short | missed`.
        var verdict: String
        var verdictLabel: String
        var plannedSeconds: Double?
        var doneSeconds: Double
    }

    nonisolated struct RepSet: Decodable, Equatable, Sendable {
        nonisolated struct Rep: Decodable, Equatable, Sendable {
            var label: String
            var verdict: String
            /// "4:49" (a run's pace per km) or "312 W".
            var text: String
            var hrText: String?
        }

        nonisolated struct Stat: Decodable, Equatable, Sendable {
            var label: String
            var value: String
        }

        var title: String
        /// "4 of 5 reps on target".
        var summary: String
        var reps: [Rep]
        var stats: [Stat]
    }

    nonisolated struct Coach: Decodable, Equatable, Sendable {
        nonisolated struct Section: Decodable, Equatable, Sendable {
            /// `effect | well | improve | next`.
            var key: String
            var title: String
            var items: [String]
        }

        /// `ready | pending | failed | off`. Pending: the app asks for it (`PUT …/review`) and shows a spinner.
        var status: String
        var note: String?
        var headline: String?
        var rating: String?
        var ratingLabel: String?
        var sections: [Section]
    }

    /// 0–100.
    var score: Int
    /// `good | partial | off`.
    var level: String
    /// "Partly on plan".
    var scoreWord: String
    var workoutName: String?
    /// "Steps from your watch's laps".
    var alignedText: String
    /// "5:04 after the plan".
    var extraText: String?
    var steps: [Step]
    var sets: [RepSet]
    var flags: [String]
    var ai: Coach

    /// The path that writes the review now and answers with the section.
    static func path(_ activityId: String) -> String { "api/app/activities/\(activityId)/review" }

    var isPending: Bool { ai.status == "pending" }
}
