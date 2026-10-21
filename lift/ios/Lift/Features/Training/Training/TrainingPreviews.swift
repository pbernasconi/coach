#if DEBUG
    import KoboTokens
    import SwiftUI

    private func trainingPreview(_ state: TrainingState) -> some View {
        NavigationStack { TrainingContent(state: state, send: { _ in }) }.koboTheme(.lift)
    }

    #Preview("Activities") { trainingPreview(.fixtureActivities) }
    #Preview("Activities, dark") { trainingPreview(.fixtureActivities).preferredColorScheme(.dark) }
    #Preview("Trends") { trainingPreview(.fixtureTrends) }
    #Preview("Trends, dark") { trainingPreview(.fixtureTrends).preferredColorScheme(.dark) }
    #Preview("Trends, AX3") { trainingPreview(.fixtureTrends).dynamicTypeSize(.accessibility3) }
    #Preview("Loading") { trainingPreview(.fixtureLoading) }
    #Preview("Failed") { trainingPreview(.fixtureFailed) }
    #Preview("Not connected") { trainingPreview(.fixtureNotConnected) }
    #Preview("Next page failed") { trainingPreview(.fixturePageFailed) }
#endif
