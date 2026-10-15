import KoboComponents
import KoboTokens
import SwiftUI

/// The Apple Health section: one switch for saving finished workouts, with where it stands under it.
struct SettingsHealthSection: View {
    let status: HealthStatus
    let send: (SettingsAction) -> Void

    var body: some View {
        ListSection("Apple Health", footer: footer) {
            ToggleRow(
                verbatim: String(localized: "Save workouts"),
                subtitle: HealthText.status(status),
                systemImage: "heart",
                isOn: .action(status.isOn) { send(.healthToggled($0)) }
            )
            .disabled(!status.canToggle)
        }
    }

    private var footer: LocalizedStringKey {
        status == .notSaved
            ? "Demo data is never saved to Apple Health."
            : "Each finished workout is saved as strength training, with its start, end and title."
    }
}
