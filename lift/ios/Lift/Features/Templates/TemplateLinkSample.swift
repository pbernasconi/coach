import Foundation
import LiftCore

/// A made-up template link for `-open template-link` in demo mode, previews and screenshots. Not anyone's real
/// workouts (TEST-8). "Lower A" matches a demo template, so the review shows the Replace switch.
nonisolated enum TemplateLinkSample {
    static let payload = TemplateLinkPayload(
        unit: "lb",
        templates: [
            .init(
                name: "Heavy lower",
                exercises: [
                    .init(name: "Back squat", sets: 3, reps: 5, weight: 185, rest: 180, note: "Made-up cue"),
                    .init(name: "Romanian deadlift", sets: 3, reps: 8, repMax: 10, weight: 135, rest: 120),
                    .init(name: "Bulgarian split squat", sets: 2, reps: 10, weight: 25, rest: 90),
                    .init(name: "Kettlebell swing", sets: 3, reps: 15, weight: 35, rest: 60),
                ]
            ),
            .init(
                name: "Pull day",
                exercises: [
                    .init(name: "Weighted pull-up", sets: 4, reps: 5, weight: 10, rest: 150),
                    .init(name: "Dumbbell bench pull", sets: 3, reps: 10, repMax: 12, weight: 30, rest: 90),
                ]
            ),
            .init(
                name: "Lower A",
                unit: "kg",
                exercises: [.init(name: "Goblet squat", sets: 3, reps: 10, weight: 20, rest: 90)]
            ),
        ]
    )

    /// `payload` as a link's `d` value; empty if it could not be encoded (it always can).
    static var encoded: String { (try? TemplateLink.encode(payload)) ?? "" }
}
