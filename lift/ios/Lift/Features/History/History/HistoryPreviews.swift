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
    #Preview("Loading") { HistoryPreview(state: .fixtureLoading) }
    #Preview("Empty") { HistoryPreview(state: .fixtureEmpty) }
    #Preview("Failed") { HistoryPreview(state: .fixtureFailed) }
    #Preview("Long text, AX3") {
        HistoryPreview(state: .fixtureLongText)
            .dynamicTypeSize(.accessibility3)
    }
#endif
