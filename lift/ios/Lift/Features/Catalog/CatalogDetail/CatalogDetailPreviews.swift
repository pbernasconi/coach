#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct CatalogDetailPreview: View {
        let state: CatalogDetailState

        var body: some View {
            NavigationStack {
                CatalogDetailContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Default") { CatalogDetailPreview(state: .fixtureDefault) }
    #Preview("Dark") { CatalogDetailPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("In library") { CatalogDetailPreview(state: .fixtureInLibrary) }
    #Preview("In library, progress") { CatalogDetailPreview(state: .fixtureInLibraryWithProgress) }
    #Preview("In library, progress, AX3") {
        CatalogDetailPreview(state: .fixtureInLibraryWithProgress)
            .dynamicTypeSize(.accessibility3)
    }
    #Preview("Adding") { CatalogDetailPreview(state: .fixtureAdding) }
    #Preview("Media failed, dark") { CatalogDetailPreview(state: .fixtureMediaFailed).preferredColorScheme(.dark) }
    #Preview("Loading") { CatalogDetailPreview(state: .fixtureLoading) }
    #Preview("Empty") { CatalogDetailPreview(state: .fixtureEmpty) }
    #Preview("Long text, AX3") {
        CatalogDetailPreview(state: .fixtureLongText)
            .dynamicTypeSize(.accessibility3)
    }
#endif
