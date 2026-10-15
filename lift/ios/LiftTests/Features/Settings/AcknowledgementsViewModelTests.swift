import Foundation
import Testing

@testable import Lift

/// One test per Action case, plus the state it starts from (TEST-2).
@MainActor
@Suite struct AcknowledgementsViewModelTests {
    @Test func stateListsTheItemsItWasGiven() async {
        let vm = AcknowledgementsViewModel(items: Acknowledgement.bundled)

        await vm.run()

        #expect(vm.state.items.map(\.id) == ["grdb", "exercises-dataset", "gym-visual"])
        #expect(vm.state.link == nil)
    }

    @Test func linkTappedAsksToOpenItEachTime() throws {
        let url = try #require(URL(string: "https://github.com/groue/GRDB.swift"))
        let vm = AcknowledgementsViewModel(items: Acknowledgement.bundled)

        let task = vm.send(.linkTapped(url))
        vm.send(.linkTapped(url))

        #expect(task == nil)
        #expect(vm.state.link == LinkRequest(serial: 2, url: url))
    }
}
