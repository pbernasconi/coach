#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct HistoryPreview: View {
        let state: HistoryState

        var body: some View {
            NavigationStack {
                HistoryContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Default") { HistoryPreview(state: .fixtureDefault) }
    #Preview("Dark") { HistoryPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("Progress") { HistoryPreview(state: .fixtureProgress) }
    #Preview("Progress, dark") { HistoryPreview(state: .fixtureProgress).preferredColorScheme(.dark) }
    #Preview("Progress, AX3") { HistoryPreview(state: .fixtureProgress).dynamicTypeSize(.accessibility3) }
    #Preview("Progress, a muscle") { HistoryPreview(state: .fixtureProgressMuscle) }
    #Preview("Progress, empty") { HistoryPreview(state: .fixtureProgressEmpty) }
    #Preview("Loading") { HistoryPreview(state: .fixtureLoading) }
    #Preview("Empty") { HistoryPreview(state: .fixtureEmpty) }
    #Preview("Failed") { HistoryPreview(state: .fixtureFailed) }
    #Preview("Long text, AX3") {
        HistoryPreview(state: .fixtureLongText)
            .dynamicTypeSize(.accessibility3)
    }
#endif
