import Foundation

/// The four tabs of the root shell. The raw value is the `-tab` launch argument.
nonisolated enum AppTab: String, CaseIterable, Hashable, Sendable {
    case week
    case history
    case exercises
    case settings

    /// The SF Symbol shown in the tab bar.
    var systemImage: String {
        switch self {
        case .week: "calendar"
        case .history: "clock.arrow.circlepath"
        case .exercises: "dumbbell"
        case .settings: "gearshape"
        }
    }
}
