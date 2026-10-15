#if DEBUG
import Core

/// Named states for previews, snapshots and the demo gallery. Fake data only (TEST-8).
extension ExampleState {
    static let fixtureDefault = ExampleState(items: .loaded(ExampleItem.samples))
    static let fixtureLoading = ExampleState(items: .loading)
    static let fixtureEmpty = ExampleState(items: .empty)
    static let fixtureFailed = ExampleState(items: .failed(.offline))
    static let fixtureLongText = ExampleState(items: .loaded([ExampleItem.sampleWithLongName]))
    static let fixtureSaving = ExampleState(items: .loaded(ExampleItem.samples), draftName: "New", save: .saving)
}
#endif
