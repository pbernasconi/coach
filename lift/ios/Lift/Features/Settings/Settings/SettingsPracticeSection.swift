import KoboComponents
import SwiftUI

/// The Practice mode section: one switch between the log and sample workouts kept apart from it, to try Lift (a
/// workout, the rest timer, the Lock Screen) without touching real data. Hidden for demo and `-fresh` launches.
struct SettingsPracticeSection: View {
    let section: PracticeSection
    let send: (SettingsAction) -> Void

    var body: some View {
        if section != .unavailable {
            ListSection("Practice", footer: footer) {
                ToggleRow(
                    "Practice mode",
                    subtitle: subtitle,
                    systemImage: "graduationcap",
                    isOn: .action(section.isOn) { send(.practiceModeToggled($0)) }
                )
            }
        }
    }

    private var subtitle: LocalizedStringKey {
        section.isOn ? "On: sample workouts" : "Off: your log"
    }

    private var footer: LocalizedStringKey {
        section.isOn
            ? "Turning it on again starts over with new sample workouts."
            : "Sample workouts that never reach your log, sync or Apple Health."
    }
}
