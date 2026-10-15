#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct WeekPreview: View {
        let state: WeekState

        var body: some View {
            NavigationStack {
                WeekContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Default") { WeekPreview(state: .fixtureDefault) }
    #Preview("Dark") { WeekPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("AX3") {
        WeekPreview(state: .fixtureDefault)
            .dynamicTypeSize(.accessibility3)
    }
    #Preview("Loading") { WeekPreview(state: .fixtureLoading) }
    #Preview("Empty") { WeekPreview(state: .fixtureEmpty) }
    #Preview("First run") { WeekPreview(state: .fixtureFirstRun) }
    #Preview("First run, AX3") {
        WeekPreview(state: .fixtureFirstRun)
            .dynamicTypeSize(.accessibility3)
    }
    #Preview("Failed") { WeekPreview(state: .fixtureFailed) }
    #Preview("Long text, AX3") {
        WeekPreview(state: .fixtureLongText)
            .dynamicTypeSize(.accessibility3)
    }
    #Preview("Lift sheet") { WeekPreview(state: .fixtureOptions) }
    #Preview("Lift sheet, dark") { WeekPreview(state: .fixtureOptions).preferredColorScheme(.dark) }
    #Preview("Move, AX3") {
        WeekPreview(state: .fixtureMove)
            .dynamicTypeSize(.accessibility3)
    }
#endif
