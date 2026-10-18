#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct TemplateLinkPreview: View {
        let state: TemplateLinkState

        var body: some View {
            TemplateLinkContent(state: state, send: { _ in })
                .koboTheme(.lift)
        }
    }

    #Preview("Loading") { TemplateLinkPreview(state: .fixtureLoading) }
    #Preview("Review") { TemplateLinkPreview(state: .fixtureReview) }
    #Preview("Review, dark") { TemplateLinkPreview(state: .fixtureReview).preferredColorScheme(.dark) }
    #Preview("Review, AX3") {
        TemplateLinkPreview(state: .fixtureReview)
            .dynamicTypeSize(.accessibility3)
    }
    #Preview("Replacing") { TemplateLinkPreview(state: .fixtureReplacing) }
    #Preview("Adding") { TemplateLinkPreview(state: .fixtureAdding) }
    #Preview("Add failed, dark") { TemplateLinkPreview(state: .fixtureAddFailed).preferredColorScheme(.dark) }
    #Preview("Unreadable") { TemplateLinkPreview(state: .fixtureUnreadable) }
    #Preview("Newer version, dark") {
        TemplateLinkPreview(state: .fixtureNewerVersion).preferredColorScheme(.dark)
    }
    #Preview("Long text, AX3") {
        TemplateLinkPreview(state: .fixtureLongText)
            .dynamicTypeSize(.accessibility3)
    }
#endif
