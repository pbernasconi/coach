#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct TodayPreview: View {
        let state: TodayState

        var body: some View {
            NavigationStack {
                TodayContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
            .environment(\.calendar, Calendar.autoupdatingCurrent.startingWeeksOnMonday())  // as CompositionRoot
        }
    }

    #Preview("Default") { TodayPreview(state: .fixtureDefault) }
    #Preview("Dark") { TodayPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("AX3") { TodayPreview(state: .fixtureDefault).dynamicTypeSize(.accessibility3) }
    #Preview("Offline") { TodayPreview(state: .fixtureOffline) }
    #Preview("Loading") { TodayPreview(state: .fixtureLoading) }
    #Preview("Not connected") { TodayPreview(state: .fixtureNotConnected) }
    #Preview("Failed") { TodayPreview(state: .fixtureFailed) }
#endif
