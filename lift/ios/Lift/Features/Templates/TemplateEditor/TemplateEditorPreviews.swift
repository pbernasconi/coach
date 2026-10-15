#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct TemplateEditorPreview: View {
        let state: TemplateEditorState

        var body: some View {
            NavigationStack {
                TemplateEditorContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Default") { TemplateEditorPreview(state: .fixtureDefault) }
    #Preview("Dark") { TemplateEditorPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("Loading") { TemplateEditorPreview(state: .fixtureLoading) }
    #Preview("Empty") { TemplateEditorPreview(state: .fixtureEmpty) }
    #Preview("Failed") { TemplateEditorPreview(state: .fixtureFailed) }
    #Preview("New") { TemplateEditorPreview(state: .fixtureNew) }
    #Preview("Slot editor") { TemplateEditorPreview(state: .fixtureEditor) }
    #Preview("Long text, AX3") {
        TemplateEditorPreview(state: .fixtureLongText)
            .dynamicTypeSize(.accessibility3)
    }
#endif
