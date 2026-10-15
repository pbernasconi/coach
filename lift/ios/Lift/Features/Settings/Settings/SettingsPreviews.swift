#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct SettingsPreview: View {
        let state: SettingsState

        var body: some View {
            NavigationStack {
                SettingsContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Default") { SettingsPreview(state: .fixtureDefault) }
    #Preview("Dark") { SettingsPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("Pounds") { SettingsPreview(state: .fixturePounds) }
    #Preview("Health not allowed") { SettingsPreview(state: .fixtureHealthDenied) }
    #Preview("Health not allowed, AX3") {
        SettingsPreview(state: .fixtureHealthDenied)
            .dynamicTypeSize(.accessibility3)
    }
    #Preview("Demo, AX3") {
        SettingsPreview(state: .fixtureDemo)
            .dynamicTypeSize(.accessibility3)
    }
    #Preview("Syncing") { SettingsPreview(state: .fixtureSyncing) }
    #Preview("Not set up") { SettingsPreview(state: .fixtureNotSetUp) }
    #Preview("Token rejected, dark") {
        SettingsPreview(state: .fixtureTokenRejected).preferredColorScheme(.dark)
    }
    #Preview("No server, AX3") {
        SettingsPreview(state: .fixtureNoServer)
            .dynamicTypeSize(.accessibility3)
    }
    #Preview("Token sheet") { SettingsPreview(state: .fixtureTokenEditor) }
    #Preview("Token sheet, dark") { SettingsPreview(state: .fixtureTokenEditor).preferredColorScheme(.dark) }
    #Preview("Token sheet, AX3") {
        SettingsPreview(state: .fixtureTokenEditor)
            .dynamicTypeSize(.accessibility3)
    }
#endif
