import Testing

@testable import KoboComponents

@Suite struct UtilitiesArrivalGateTests {
    @Test func aPushRunsTheActionOnlyAfterTheTransitionEnds() {
        var gate = ArrivalGate()
        let onAppear = gate.viewAppeared()
        let onTransitionEnd = gate.pageAppeared()
        #expect(!onAppear)
        #expect(onTransitionEnd)
    }

    @Test func aViewThatAppearsOnAShowingPageRunsAtOnce() {
        var gate = ArrivalGate()
        let onPage = gate.pageAppeared()
        let onAppear = gate.viewAppeared()
        #expect(!onPage)
        #expect(onAppear)
    }

    @Test func aCoverThatClosesOverThePageRunsNothing() {
        var gate = ArrivalGate()
        _ = gate.viewAppeared()
        _ = gate.pageAppeared()
        gate.pageWillDisappear()
        let result1 = gate.pageAppeared()
        #expect(!result1)
    }

    @Test func aPopBackRunsTheActionAgain() {
        var gate = ArrivalGate()
        _ = gate.viewAppeared()
        _ = gate.pageAppeared()
        gate.pageWillDisappear()
        gate.viewDisappeared()
        let onAppear = gate.viewAppeared()
        let afterPop = gate.pageAppeared()
        #expect(!onAppear)
        #expect(afterPop)
    }

    @Test func onceRunsOnlyTheFirstArrival() {
        var gate = ArrivalGate(frequency: .once)
        _ = gate.viewAppeared()
        let result2 = gate.pageAppeared()
        #expect(result2)
        gate.pageWillDisappear()
        gate.viewDisappeared()
        _ = gate.viewAppeared()
        let result3 = gate.pageAppeared()
        #expect(!result3)
    }

    @Test func aViewThatLeavesBeforeTheTransitionEndsRunsNothing() {
        var gate = ArrivalGate()
        _ = gate.viewAppeared()
        gate.viewDisappeared()
        let result4 = gate.pageAppeared()
        #expect(!result4)
    }

    @Test func aHeldPresentationRunsTheActionWhenItSettles() {
        var gate = ArrivalGate()
        let onAppear = gate.viewAppeared(held: true)
        let onShown = gate.pageAppeared()
        let onSettled = gate.holdChanged(false)
        #expect(!onAppear)
        #expect(!onShown)
        #expect(onSettled)
        let result5 = gate.holdChanged(true)
        #expect(!result5)
        let result6 = gate.holdChanged(false)
        #expect(!result6)
    }
}
