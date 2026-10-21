import KoboComponents
import KoboTokens
import SwiftUI

/// The Apple Health section: one switch for saving finished workouts, with where it stands under it; a status row
/// where there is nothing to switch.
struct SettingsHealthSection: View {
    let status: HealthStatus
    let send: (SettingsAction) -> Void

    var body: some View {
        ListSection("Apple Health", footer: footer) {
            if status.canToggle {
                ToggleRow(
                    verbatim: String(localized: "Save workouts"),
                    subtitle: HealthText.status(status),
                    systemImage: "heart",
                    isOn: .action(status.isOn) { send(.healthToggled($0)) }
                )
            } else {
                // Nothing to switch here (demo data, or no Health on this device): a plain status row, like Sync's.
                ListRow("Status", value: HealthText.status(status))
            }
        }
    }

    private var footer: LocalizedStringKey {
        status == .notSaved
            ? "Demo and practice data are never saved to Apple Health."
            : "Each finished workout is saved as strength training, with its start, end and title."
    }
}
