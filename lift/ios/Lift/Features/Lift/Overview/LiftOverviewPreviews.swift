#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct LiftOverviewPreview: View {
        let state: LiftOverviewState

        var body: some View {
            NavigationStack {
                LiftOverviewContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
            .environment(\.calendar, Calendar.autoupdatingCurrent.startingWeeksOnMonday())  // as CompositionRoot
        }
    }

    #Preview("Default") { LiftOverviewPreview(state: .fixtureDefault) }
    #Preview("Dark") { LiftOverviewPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("Default, AX3") { LiftOverviewPreview(state: .fixtureDefault).dynamicTypeSize(.accessibility3) }
    #Preview("Expanded") { LiftOverviewPreview(state: .fixtureExpanded) }
    #Preview("Empty") { LiftOverviewPreview(state: .fixtureEmpty) }
    #Preview("Failed sections") { LiftOverviewPreview(state: .fixtureFailedSections) }
    #Preview("Loading") { LiftOverviewPreview(state: .fixtureLoading) }
    #Preview("Not connected") { LiftOverviewPreview(state: .fixtureNotConnected) }
    #Preview("Failed") { LiftOverviewPreview(state: .fixtureFailed) }
#endif
