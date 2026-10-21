#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct LiftWeeklyPreview: View {
        let state: LiftWeeklyState

        var body: some View {
            NavigationStack {
                LiftWeeklyContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Default") { LiftWeeklyPreview(state: .fixtureDefault) }
    #Preview("Dark") { LiftWeeklyPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("AX3") { LiftWeeklyPreview(state: .fixtureDefault).dynamicTypeSize(.accessibility3) }
    #Preview("No weeks") { LiftWeeklyPreview(state: .fixtureEmpty) }
    #Preview("Section failed") { LiftWeeklyPreview(state: .fixtureFailedSection) }
    #Preview("Loading") { LiftWeeklyPreview(state: .fixtureLoading) }
    #Preview("Not connected") { LiftWeeklyPreview(state: .fixtureNotConnected) }
    #Preview("Failed") { LiftWeeklyPreview(state: .fixtureFailed) }
#endif
