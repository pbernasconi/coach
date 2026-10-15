#if DEBUG
    import KoboTokens
    import SwiftUI

    private struct PlatesPreview: View {
        let state: PlatesState

        var body: some View {
            NavigationStack {
                PlatesContent(state: state, send: { _ in })
            }
            .koboTheme(.lift)
        }
    }

    #Preview("Default") { PlatesPreview(state: .fixtureDefault) }
    #Preview("Dark") { PlatesPreview(state: .fixtureDefault).preferredColorScheme(.dark) }
    #Preview("Pounds") { PlatesPreview(state: .fixturePounds) }
    #Preview("Loading") { PlatesPreview(state: .fixtureLoading) }
    #Preview("Home gym") { PlatesPreview(state: .fixtureHome) }
    #Preview("Plate sheet") { PlatesPreview(state: .fixturePlateSheet) }
    #Preview("Plate off") { PlatesPreview(state: .fixturePlateOffSheet) }
    #Preview("Home gym, AX3") {
        PlatesPreview(state: .fixtureHome)
            .dynamicTypeSize(.accessibility3)
    }
#endif
