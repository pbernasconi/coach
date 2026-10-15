import Foundation

extension HealthStatus {
    /// Whether the Settings switch shows on: saving is on in Lift, whatever Health says.
    nonisolated var isOn: Bool {
        switch self {
        case .notAsked, .denied, .on: true
        case .notSaved, .unavailable, .off: false
        }
    }

    /// Whether the Settings switch can change anything here.
    nonisolated var canToggle: Bool { self != .notSaved && self != .unavailable }
}

/// Plain labels for the Apple Health status.
nonisolated enum HealthText {
    /// The line under the Settings switch.
    static func status(_ status: HealthStatus) -> String {
        switch status {
        case .notSaved: String(localized: "Off")
        case .unavailable: String(localized: "Not available on this device")
        case .off: String(localized: "Off")
        case .notAsked: String(localized: "Asks when you finish a workout")
        case .denied: String(localized: "Not allowed. Allow Lift in Settings › Health › Data Access & Devices.")
        case .on: String(localized: "On")
        }
    }
}
