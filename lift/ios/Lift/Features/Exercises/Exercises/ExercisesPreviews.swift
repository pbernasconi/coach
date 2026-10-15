#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct ExercisesPreview: View {
        let state: ExercisesState

        var body: some View {
            NavigationStack {
                ExercisesContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Default") { ExercisesPreview(state: .fixtureDefault) }
    #Preview("Dark") { ExercisesPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("Loading") { ExercisesPreview(state: .fixtureLoading) }
    #Preview("Empty") { ExercisesPreview(state: .fixtureEmpty) }
    #Preview("Failed") { ExercisesPreview(state: .fixtureFailed) }
    #Preview("Search") { ExercisesPreview(state: .fixtureSearch) }
    #Preview("No matches") { ExercisesPreview(state: .fixtureNoMatches) }
    #Preview("Long text, AX3") {
        ExercisesPreview(state: .fixtureLongText)
            .dynamicTypeSize(.accessibility3)
    }
#endif
