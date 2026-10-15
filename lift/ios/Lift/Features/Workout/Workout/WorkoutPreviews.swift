#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct WorkoutPreview: View {
        let state: WorkoutState

        var body: some View {
            NavigationStack {
                WorkoutContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Default") { WorkoutPreview(state: .fixtureDefault) }
    #Preview("Dark") { WorkoutPreview(state: .fixtureResting).preferredColorScheme(.dark) }
    #Preview("Resting") { WorkoutPreview(state: .fixtureResting) }
    #Preview("Editing") { WorkoutPreview(state: .fixtureEditing) }
    #Preview("Loading") { WorkoutPreview(state: .fixtureLoading) }
    #Preview("Empty") { WorkoutPreview(state: .fixtureEmpty) }
    #Preview("Failed") { WorkoutPreview(state: .fixtureFailed) }
    #Preview("Default, AX3") {
        WorkoutPreview(state: .fixtureResting)
            .dynamicTypeSize(.accessibility3)
    }
    #Preview("Long text, AX3") {
        WorkoutPreview(state: .fixtureLongText)
            .dynamicTypeSize(.accessibility3)
    }
#endif
