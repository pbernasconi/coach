import KoboComponents
import KoboTokens
import SwiftUI

/// This iPhone: how its sync with Coach stands (with Sync now and the token), and saving workouts to Apple Health.
/// Demo and practice data never sync and never reach Health: one row says so.
struct SettingsPhoneSection: View {
    let section: SyncSection
    let health: HealthStatus
    let send: (SettingsAction) -> Void

    var body: some View {
        ListSection("This iPhone", footer: footer) {
            syncRows
            if health.canToggle {
                ToggleRow(
                    verbatim: String(localized: "Save to Apple Health"),
                    subtitle: HealthText.status(health),
                    systemImage: "heart",
                    isOn: .action(health.isOn) { send(.healthToggled($0)) }
                )
            } else {
                ListRow(verbatim: String(localized: "Apple Health"), value: HealthText.status(health)) {
                    SettingsIcon(symbol: "heart", tone: .danger)
                }
            }
        }
    }

    @ViewBuilder private var syncRows: some View {
        switch section {
        case .demo:
            ListRow(verbatim: String(localized: "Sync with Coach"), value: String(localized: "Off")) {
                SettingsIcon(symbol: "arrow.triangle.2.circlepath", tone: .info)
            }
        case .unavailable:
            ListRow(verbatim: String(localized: "Sync with Coach"), value: String(localized: "Not set up")) {
                SettingsIcon(symbol: "arrow.triangle.2.circlepath", tone: .info)
            }
        case .available(let summary):
            ListRow(verbatim: String(localized: "Sync with Coach"), subtitle: summary.status) {
                SettingsIcon(symbol: "arrow.triangle.2.circlepath", tone: .info)
            } trailing: {
                Button("Sync now") { send(.syncNowTapped) }
                    .buttonStyle(.kobo(.tonal, size: .compact))
                    .disabled(!summary.canSyncNow)
            }
            ListRow(
                verbatim: String(localized: "Sync token"),
                value: summary.hasToken ? String(localized: "Saved") : String(localized: "Not set"),
                action: { send(.tokenRowTapped) }
            ) {
                SettingsIcon(symbol: "key.fill", tone: .neutral)
            }
        }
    }

    private var footer: LocalizedStringKey? {
        switch section {
        case .demo: "Demo and practice data never sync or reach Apple Health."
        case .unavailable: "This build of Coach has no sync server."
        case .available: nil
        }
    }
}

/// The token field in the sync token sheet. Shows nothing that was saved before: a saved token is only replaced.
struct TokenEditorField: View {
    let editor: TokenEditor
    let send: (SettingsAction) -> Void

    var body: some View {
        KoboSecureField(
            "Sync token",
            text: .action(editor.draft) { send(.tokenDraftChanged($0)) },
            prompt: "Paste the token",
            helper: "The LIFT_SYNC_TOKEN set on your coach web app. Kept in this iPhone's Keychain.",
            error: editor.save == .failed ? .message(String(localized: "That did not work. Try again.")) : .none
        )
    }
}

/// Save (then sync) and, when a token is stored, Remove.
struct TokenEditorButtons: View {
    let editor: TokenEditor
    let send: (SettingsAction) -> Void

    var body: some View {
        VStack(spacing: Space.sm) {
            Button("Save and sync") { send(.tokenSaveTapped) }
                .buttonStyle(.kobo(.primary, width: .full, isLoading: editor.save == .saving))
                .disabled(!editor.canSave)
            if editor.canRemove {
                Button("Remove token", role: .destructive) { send(.tokenRemoveTapped) }
                    .buttonStyle(.kobo(.destructive, width: .full))
                    .disabled(editor.save == .saving)
            }
        }
    }
}
