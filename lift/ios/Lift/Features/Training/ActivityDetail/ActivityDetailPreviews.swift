#if DEBUG
    import KoboTokens
    import SwiftUI

    private func activityPreview(_ state: ActivityDetailState) -> some View {
        NavigationStack { ActivityDetailContent(state: state, send: { _ in }) }.koboTheme(.lift)
    }

    #Preview("Run") { activityPreview(.fixtureRun) }
    #Preview("Run, dark") { activityPreview(.fixtureRun).preferredColorScheme(.dark) }
    #Preview("Run by time, AX3") { activityPreview(.fixtureRunByTime).dynamicTypeSize(.accessibility3) }
    #Preview("Ride with power") { activityPreview(.fixtureRide) }
    #Preview("Loading from Strava") { activityPreview(.fixturePending) }
    #Preview("Loading") { activityPreview(.fixtureLoading) }
    #Preview("Failed") { activityPreview(.fixtureFailed) }
#endif
