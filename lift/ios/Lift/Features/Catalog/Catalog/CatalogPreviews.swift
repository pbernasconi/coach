#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct CatalogPreview: View {
        let state: CatalogState

        var body: some View {
            NavigationStack {
                CatalogContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Default") { CatalogPreview(state: .fixtureDefault) }
    #Preview("Dark") { CatalogPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("Loading") { CatalogPreview(state: .fixtureLoading) }
    #Preview("Empty") { CatalogPreview(state: .fixtureEmpty) }
    #Preview("Failed") { CatalogPreview(state: .fixtureFailed) }
    #Preview("Filtered") { CatalogPreview(state: .fixtureFiltered) }
    #Preview("No matches") { CatalogPreview(state: .fixtureNoMatches) }
    #Preview("Long text, AX3") {
        CatalogPreview(state: .fixtureLongText)
            .dynamicTypeSize(.accessibility3)
    }
#endif
