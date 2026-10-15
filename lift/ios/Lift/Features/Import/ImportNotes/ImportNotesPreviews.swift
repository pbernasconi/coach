#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct ImportNotesPreview: View {
        let state: ImportNotesState

        var body: some View {
            ImportNotesContent(state: state, send: { _ in })
                .koboTheme(.lift)
        }
    }

    #Preview("Empty") { ImportNotesPreview(state: .fixtureEmpty) }
    #Preview("Filled, dark") { ImportNotesPreview(state: .fixtureFilled).preferredColorScheme(.dark) }
    #Preview("Reading") { ImportNotesPreview(state: .fixtureReading) }
    #Preview("Nothing parsed") { ImportNotesPreview(state: .fixtureNothingParsed) }
    #Preview("Review") { ImportNotesPreview(state: .fixtureReview) }
    #Preview("Review, dark") { ImportNotesPreview(state: .fixtureReview).preferredColorScheme(.dark) }
    #Preview("Importing") { ImportNotesPreview(state: .fixtureImporting) }
    #Preview("Finished") { ImportNotesPreview(state: .fixtureFinished) }
    #Preview("Partial failure, dark") {
        ImportNotesPreview(state: .fixturePartialFailure).preferredColorScheme(.dark)
    }
    #Preview("Long text, AX3") {
        ImportNotesPreview(state: .fixtureLongText)
            .dynamicTypeSize(.accessibility3)
    }
    #Preview("Paste, AX3") {
        ImportNotesPreview(state: .fixtureFilled)
            .dynamicTypeSize(.accessibility3)
    }
#endif
