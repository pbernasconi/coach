#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct AcknowledgementsPreview: View {
        let state: AcknowledgementsState

        var body: some View {
            NavigationStack {
                AcknowledgementsContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Default") { AcknowledgementsPreview(state: .fixtureDefault) }
    #Preview("Dark") { AcknowledgementsPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("Empty") { AcknowledgementsPreview(state: .fixtureEmpty) }
    #Preview("Default, AX3") {
        AcknowledgementsPreview(state: .fixtureDefault)
            .dynamicTypeSize(.accessibility3)
    }
#endif
