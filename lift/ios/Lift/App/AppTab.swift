import Foundation

/// The five tabs of the root shell, Week (the home page) first. The raw value is the `-tab` launch argument; `-tab history` and `-tab exercises`
/// open the Lift tab on that segment (`LaunchOptions`).
nonisolated enum AppTab: String, CaseIterable, Hashable, Sendable {
    case week
    case today
    case coach
    case lift
    case settings

    /// The SF Symbol shown in the tab bar.
    var systemImage: String {
        switch self {
        case .today: "chart.line.uptrend.xyaxis"  // shown as Fitness
        case .week: "calendar"
        case .coach: "bubble.left.and.text.bubble.right"
        case .lift: "dumbbell"
        case .settings: "gearshape"
        }
    }
}

/// The segments of the Lift tab: the coach's Lift overview, the logged sessions, and the exercise library.
nonisolated enum LiftSegment: String, CaseIterable, Hashable, Sendable {
    case overview
    case history
    case exercises
}
