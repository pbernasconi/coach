#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct ExerciseDetailPreview: View {
        let state: ExerciseDetailState

        var body: some View {
            NavigationStack {
                ExerciseDetailContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Default") { ExerciseDetailPreview(state: .fixtureDefault) }
    #Preview("Dark") { ExerciseDetailPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("With media") { ExerciseDetailPreview(state: .fixtureWithMedia) }
    #Preview("No history") { ExerciseDetailPreview(state: .fixtureNoHistory) }
    #Preview("Custom exercise") { ExerciseDetailPreview(state: .fixtureCustom) }
    #Preview("Loading") { ExerciseDetailPreview(state: .fixtureLoading) }
    #Preview("Empty") { ExerciseDetailPreview(state: .fixtureEmpty) }
    #Preview("Failed") { ExerciseDetailPreview(state: .fixtureFailed) }
    #Preview("History loading, dark") {
        ExerciseDetailPreview(state: .fixtureHistoryLoading).preferredColorScheme(.dark)
    }
    #Preview("Default, AX3") {
        ExerciseDetailPreview(state: .fixtureDefault)
            .dynamicTypeSize(.accessibility3)
    }
#endif
