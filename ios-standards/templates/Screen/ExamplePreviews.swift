#if DEBUG
    import SwiftUI

    #Preview("Default") { ExampleContent(state: .fixtureDefault, send: { _ in }) }
    #Preview("Loading") { ExampleContent(state: .fixtureLoading, send: { _ in }) }
    #Preview("Empty") { ExampleContent(state: .fixtureEmpty, send: { _ in }) }
    #Preview("Failed") { ExampleContent(state: .fixtureFailed, send: { _ in }) }
    #Preview("Long text, AX3") {
        ExampleContent(state: .fixtureLongText, send: { _ in })
            .dynamicTypeSize(.accessibility3)
    }
    #Preview("Saving") { ExampleContent(state: .fixtureSaving, send: { _ in }) }
#endif
