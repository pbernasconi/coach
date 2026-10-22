#if DEBUG
    import KoboTokens
    import LiftCore
    import SwiftUI

    private struct WeekPreview: View {
        let state: WeekState

        var body: some View {
            NavigationStack {
                WeekContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
            .environment(\.calendar, Calendar.autoupdatingCurrent.startingWeeksOnMonday())  // as CompositionRoot
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
    #Preview("Two on a day") { WeekPreview(state: .fixtureTwoOnADay) }
    #Preview("Failed") { WeekPreview(state: .fixtureFailed) }
    #Preview("Long text, AX3") {
        WeekPreview(state: .fixtureLongText)
            .dynamicTypeSize(.accessibility3)
    }
    #Preview("Lift sheet") { WeekPreview(state: .fixtureOptions) }
    #Preview("Lift sheet, dark") { WeekPreview(state: .fixtureOptions).preferredColorScheme(.dark) }
    #Preview("Plan") { WeekPreview(state: .fixturePlan) }
    #Preview("Plan, dark") { WeekPreview(state: .fixturePlan).preferredColorScheme(.dark) }
    #Preview("Plan, AX3") {
        WeekPreview(state: .fixturePlan)
            .dynamicTypeSize(.accessibility3)
    }
    #Preview("Plan, offline") { WeekPreview(state: .fixturePlanOffline) }
    #Preview("Move, AX3") {
        WeekPreview(state: .fixtureMove)
            .dynamicTypeSize(.accessibility3)
    }
#endif
