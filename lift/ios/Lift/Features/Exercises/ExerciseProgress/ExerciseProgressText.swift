import Foundation
import LiftCore

/// Plain labels for the progress chart: numbers and units, no commentary.
nonisolated enum ExerciseProgressText {
    /// "3M", "6M", "1Y", "All": the range picker's segments.
    static func title(_ range: ProgressRange) -> String {
        switch range {
        case .threeMonths: String(localized: "3M", comment: "Progress range: the last 3 months")
        case .sixMonths: String(localized: "6M", comment: "Progress range: the last 6 months")
        case .year: String(localized: "1Y", comment: "Progress range: the last year")
        case .all: String(localized: "All", comment: "Progress range: every session")
        }
    }

    /// "No sessions in the last 3 months".
    static func noSessions(in range: ProgressRange) -> String {
        switch range {
        case .threeMonths: String(localized: "No sessions in the last 3 months")
        case .sixMonths: String(localized: "No sessions in the last 6 months")
        case .year: String(localized: "No sessions in the last year")
        case .all: String(localized: "No sessions yet")
        }
    }

    /// "12 sessions in the last 3 months." for VoiceOver.
    static func sessions(_ count: Int, in range: ProgressRange) -> String {
        switch range {
        case .threeMonths: String(localized: "\(count) sessions in the last 3 months.")
        case .sixMonths: String(localized: "\(count) sessions in the last 6 months.")
        case .year: String(localized: "\(count) sessions in the last year.")
        case .all: String(localized: "\(count) sessions.")
        }
    }

    /// "+6.5 kg since Jul 14", "−2 kg since Jul 14", "0 kg since Jul 14".
    static func change(_ change: Weight, since day: String) -> String {
        let sign = change.value > 0 ? "+" : change.value < 0 ? "−" : ""
        let amount = WorkoutText.weight(Weight(abs(change.value), change.unit))
        return String(localized: "\(sign)\(amount) since \(day)")
    }
}
