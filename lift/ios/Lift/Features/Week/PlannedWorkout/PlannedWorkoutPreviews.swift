#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct PlannedWorkoutPreview: View {
        let state: PlannedWorkoutState

        var body: some View {
            NavigationStack {
                PlannedWorkoutContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Default") { PlannedWorkoutPreview(state: .fixtureDefault) }
    #Preview("Dark") { PlannedWorkoutPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("AX3") { PlannedWorkoutPreview(state: .fixtureDefault).dynamicTypeSize(.accessibility3) }
    #Preview("Done") { PlannedWorkoutPreview(state: .fixtureDone) }
    #Preview("No steps") { PlannedWorkoutPreview(state: .fixtureNoSteps) }
    #Preview("Loading") { PlannedWorkoutPreview(state: .fixtureLoading) }
    #Preview("Not connected") { PlannedWorkoutPreview(state: .fixtureNotConnected) }
    #Preview("Failed") { PlannedWorkoutPreview(state: .fixtureFailed) }
#endif
