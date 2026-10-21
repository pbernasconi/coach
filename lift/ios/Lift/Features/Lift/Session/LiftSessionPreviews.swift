#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct LiftSessionPreview: View {
        let state: LiftSessionState

        var body: some View {
            NavigationStack {
                LiftSessionContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Default") { LiftSessionPreview(state: .fixtureDefault) }
    #Preview("Dark") { LiftSessionPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("Default, AX3") { LiftSessionPreview(state: .fixtureDefault).dynamicTypeSize(.accessibility3) }
    #Preview("Planned") { LiftSessionPreview(state: .fixturePlanned) }
    #Preview("Failed section") { LiftSessionPreview(state: .fixtureFailedSection) }
    #Preview("Loading") { LiftSessionPreview(state: .fixtureLoading) }
    #Preview("Failed") { LiftSessionPreview(state: .fixtureFailed) }
#endif
