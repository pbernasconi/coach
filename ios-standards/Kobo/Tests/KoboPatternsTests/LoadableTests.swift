import Foundation
import Testing

@testable import KoboPatterns

@Suite struct LoadableTests {
    @Test func phaseIgnoresPayload() {
        #expect(Loadable<Int>.loading.phase == .loading)
        #expect(Loadable<Int>.empty.phase == .empty)
        #expect(Loadable<Int>.loaded(1).phase == Loadable<Int>.loaded(2).phase)
        #expect(Loadable<Int>.failed(message: "x").phase == .failed)
    }

    @Test func valueOnlyWhenLoaded() {
        #expect(Loadable<Int>.loaded(3).value == 3)
        #expect(Loadable<Int>.loading.value == nil)
        #expect(Loadable<Int>.failed(message: "x").value == nil)
    }

    @Test func mapKeepsOtherPhases() {
        #expect(Loadable<Int>.loaded(2).map { $0 * 10 } == .loaded(20))
        #expect(Loadable<Int>.empty.map { $0 * 10 } == .empty)
        #expect(
            Loadable<Int>.failed(message: "Offline", retryLabel: "Reload").map { String($0) }
                == .failed(message: "Offline", retryLabel: "Reload")
        )
    }

    @Test func fromCollectionIsEmptyWhenEmpty() {
        #expect(Loadable<[Int]>.from([]) == .empty)
        #expect(Loadable<[Int]>.from([1]) == .loaded([1]))
    }

    @Test func failedRetryLabelDefaultsToNil() {
        #expect(Loadable<Int>.failed(message: "x") == .failed(message: "x", retryLabel: nil))
    }

    #if canImport(SwiftUI)  // the LocalizedStringResource overload lives in a SwiftUI file
        @Test func localizedFailureStoresTheResolvedCopy() {
            #expect(
                Loadable<Int>.failed("Offline", retryLabel: "Reload")
                    == .failed(message: "Offline", retryLabel: "Reload")
            )
        }
    #endif
}
