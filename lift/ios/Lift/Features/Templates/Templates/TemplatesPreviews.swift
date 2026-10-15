#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct TemplatesPreview: View {
        let state: TemplatesState

        var body: some View {
            NavigationStack {
                TemplatesContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Default") { TemplatesPreview(state: .fixtureDefault) }
    #Preview("Dark") { TemplatesPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("Loading") { TemplatesPreview(state: .fixtureLoading) }
    #Preview("Empty") { TemplatesPreview(state: .fixtureEmpty) }
    #Preview("Failed") { TemplatesPreview(state: .fixtureFailed) }
    #Preview("Options") { TemplatesPreview(state: .fixtureOptions) }
    #Preview("Long text, AX3") {
        TemplatesPreview(state: .fixtureLongText)
            .dynamicTypeSize(.accessibility3)
    }
#endif
