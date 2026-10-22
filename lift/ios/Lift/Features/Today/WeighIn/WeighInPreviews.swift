#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct WeighInPreview: View {
        let state: WeighInState

        var body: some View {
            NavigationStack {
                WeighInContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Default") { WeighInPreview(state: .fixtureDefault) }
    #Preview("Dark") { WeighInPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("AX3") { WeighInPreview(state: .fixtureDefault).dynamicTypeSize(.accessibility3) }
    #Preview("First weigh-in") { WeighInPreview(state: .fixtureFirst) }
    #Preview("Loading") { WeighInPreview(state: .fixtureLoading) }
    #Preview("Not connected") { WeighInPreview(state: .fixtureNotConnected) }
    #Preview("Failed") { WeighInPreview(state: .fixtureFailed) }
#endif
