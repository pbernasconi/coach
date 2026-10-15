import KoboComponents
import KoboTokens
import SwiftUI

/// The Sync section: status, "Sync now" and the token row, or a note when this data or build never syncs.
struct SettingsSyncSection: View {
    let section: SyncSection
    let send: (SettingsAction) -> Void

    var body: some View {
        switch section {
        case .demo:
            ListSection("Sync", footer: "Demo data is never synced.") {
                ListRow("Status", value: String(localized: "Off"))
            }
        case .unavailable:
            ListSection("Sync", footer: "This build of Lift has no sync server.") {
                ListRow("Status", value: String(localized: "Not set up"))
            }
        case .available(let summary):
            ListSection(
                "Sync",
                footer: "Sends your workouts to your coach web app. Logging never waits for the network."
            ) {
                ListRow("Status", value: summary.status)
                ListRow("Sync now", action: { send(.syncNowTapped) }) {
                    EmptyView()
                } trailing: {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .accessibilityHidden(true)
                }
                .disabled(!summary.canSyncNow)
                ListRow(
                    "Sync token",
                    value: summary.hasToken ? String(localized: "Saved") : String(localized: "Not set"),
                    action: { send(.tokenRowTapped) }
                )
            }
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
