#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct ExercisePickerPreview: View {
        let state: ExercisePickerState

        var body: some View {
            NavigationStack {
                ExercisePickerContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Default") { ExercisePickerPreview(state: .fixtureDefault) }
    #Preview("Dark") { ExercisePickerPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("Loading") { ExercisePickerPreview(state: .fixtureLoading) }
    #Preview("Empty") { ExercisePickerPreview(state: .fixtureEmpty) }
    #Preview("Failed") { ExercisePickerPreview(state: .fixtureFailed) }
    #Preview("Catalog") { ExercisePickerPreview(state: .fixtureCatalog) }
    #Preview("No matches") { ExercisePickerPreview(state: .fixtureNoMatches) }
    #Preview("Long text, AX3") {
        ExercisePickerPreview(state: .fixtureLongText)
            .dynamicTypeSize(.accessibility3)
    }
#endif
