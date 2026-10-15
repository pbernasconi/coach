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
    #Preview("Loading") { WeekPreview(state: .fixtureLoading) }
    #Preview("Empty") { WeekPreview(state: .fixtureEmpty) }
    #Preview("Failed") { WeekPreview(state: .fixtureFailed) }
    #Preview("Long text, AX3") {
        WeekPreview(state: .fixtureLongText)
            .dynamicTypeSize(.accessibility3)
    }
#endif
