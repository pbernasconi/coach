#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct WeekPlannerPreview: View {
        let state: WeekPlannerState

        var body: some View {
            WeekPlannerContent(state: state, send: { _ in })
                .koboTheme(.lift)
        }
    }

    #Preview("Draft") { WeekPlannerPreview(state: .fixtureProposed) }
    #Preview("Draft, dark") { WeekPlannerPreview(state: .fixtureProposed).preferredColorScheme(.dark) }
    #Preview("Draft, AX3") {
        WeekPlannerPreview(state: .fixtureProposed)
            .dynamicTypeSize(.accessibility3)
    }
    #Preview("Last week") { WeekPlannerPreview(state: .fixtureLastWeek) }
    #Preview("Last week, dark") { WeekPlannerPreview(state: .fixtureLastWeek).preferredColorScheme(.dark) }
    #Preview("Shape") { WeekPlannerPreview(state: .fixtureShape) }
    #Preview("Shape, dark") { WeekPlannerPreview(state: .fixtureShape).preferredColorScheme(.dark) }
    #Preview("Drafting") { WeekPlannerPreview(state: .fixtureDrafting) }
    #Preview("No plan yet") { WeekPlannerPreview(state: .fixtureNone) }
    #Preview("Session") { WeekPlannerPreview(state: .fixtureSession) }
    #Preview("Accept") { WeekPlannerPreview(state: .fixtureAccept) }
    #Preview("Refused") { WeekPlannerPreview(state: .fixtureRefused) }
    #Preview("Loading") { WeekPlannerPreview(state: .fixtureLoading) }
#endif
