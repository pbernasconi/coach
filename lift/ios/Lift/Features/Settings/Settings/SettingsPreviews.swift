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
    #Preview("Demo, AX3") {
        SettingsPreview(state: .fixtureDemo)
            .dynamicTypeSize(.accessibility3)
    }
#endif
