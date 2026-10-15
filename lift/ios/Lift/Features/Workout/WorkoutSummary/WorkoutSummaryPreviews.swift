#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct WorkoutSummaryPreview: View {
        let state: WorkoutSummaryState

        var body: some View {
            NavigationStack {
                WorkoutSummaryContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Default") { WorkoutSummaryPreview(state: .fixtureDefault) }
    #Preview("Dark") { WorkoutSummaryPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("Health prompt") { WorkoutSummaryPreview(state: .fixtureHealthPrompt) }
    #Preview("Health prompt, AX3") {
        WorkoutSummaryPreview(state: .fixtureHealthPrompt)
            .dynamicTypeSize(.accessibility3)
    }
    #Preview("Loading") { WorkoutSummaryPreview(state: .fixtureLoading) }
    #Preview("Empty") { WorkoutSummaryPreview(state: .fixtureEmpty) }
    #Preview("Failed") { WorkoutSummaryPreview(state: .fixtureFailed) }
    #Preview("No bests") { WorkoutSummaryPreview(state: .fixtureNoBests) }
    #Preview("Long text, AX3") {
        WorkoutSummaryPreview(state: .fixtureLongText)
            .dynamicTypeSize(.accessibility3)
    }
#endif
