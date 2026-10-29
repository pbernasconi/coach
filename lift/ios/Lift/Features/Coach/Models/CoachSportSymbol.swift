import Foundation

/// The SF Symbol for a planned workout's sport on the change card (lift/COACH-CHAT.md, "The change card").
nonisolated enum CoachSportSymbol {
    static func name(_ sport: String?, title: String) -> String {
        if title.localizedCaseInsensitiveContains("physio") || title.localizedCaseInsensitiveContains("mobility") {
            return "figure.flexibility"
        }
        switch sport {
        case "run": return "figure.run"
        case "ride": return "figure.outdoor.cycle"
        case "swim": return "figure.pool.swim"
        case "strength": return "dumbbell"
        case "hike": return "figure.hiking"
        case "walk": return "figure.walk"
        case "yoga": return "figure.yoga"
        case "rest": return "bed.double"
        default: return "figure.mixed.cardio"
        }
    }
}
