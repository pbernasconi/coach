import Foundation
import Testing

@testable import Lift

/// The rest shared with the Live Activity's +30s and Skip: its rules, the App Group store and what the buttons do.
/// A made-up wall clock only (TEST-3).
@Suite struct RestSnapshotTests {
    private static let start = Date(timeIntervalSince1970: 1_772_442_000)
    private static let rest = RestSnapshot(endsAt: start.addingTimeInterval(90), totalSeconds: 90)

    @Test func extendedMovesTheEndAndTheTotal() {
        let next = Self.rest.extended(by: 30, at: Self.start.addingTimeInterval(10))
        #expect(next == RestSnapshot(endsAt: Self.start.addingTimeInterval(120), totalSeconds: 120))
    }

    @Test func aRestThatIsOverCannotBeExtended() {
        #expect(Self.rest.extended(by: 30, at: Self.start.addingTimeInterval(90)) == nil)
    }

    @Test(arguments: [(0.0, 90), (0.5, 90), (89.2, 1), (90.0, 0), (200.0, 0)])
    func secondsLeftRoundUpAndNeverGoBelowZero(elapsed: Double, left: Int) {
        #expect(Self.rest.secondsLeft(at: Self.start.addingTimeInterval(elapsed)) == left)
    }

    @Test func theAddButtonSavesTheLongerRest() {
        let store = InMemoryRestSnapshotStore(Self.rest)
        let next = RestButtonAction.extend(store, at: Self.start)
        #expect(next?.totalSeconds == 120)
        #expect(store.load() == next)
    }

    @Test func theAddButtonClearsARestThatIsOver() {
        let store = InMemoryRestSnapshotStore(Self.rest)
        #expect(RestButtonAction.extend(store, at: Self.start.addingTimeInterval(95)) == nil)
        #expect(store.load() == nil)
    }

    @Test func theAddButtonWithoutARestDoesNothing() {
        let store = InMemoryRestSnapshotStore()
        #expect(RestButtonAction.extend(store, at: Self.start) == nil)
        #expect(store.load() == nil)
    }

    @Test func theSkipButtonClearsTheRest() {
        let store = InMemoryRestSnapshotStore(Self.rest)
        RestButtonAction.skip(store)
        #expect(store.load() == nil)
    }

    @Test func theAppGroupStoreKeepsAndClearsTheRest() {
        let store = AppGroupRestSnapshotStore(suiteName: "lift.tests.rest.\(UUID().uuidString)")
        #expect(store.load() == nil)
        store.save(Self.rest)
        #expect(store.load() == Self.rest)
        #expect(AppGroupRestSnapshotStore(suiteName: store.suiteName).load() == Self.rest)
        store.save(nil)
        #expect(store.load() == nil)
    }

    @Test func aTickTakesInTimeAddedOnTheLockScreen() {
        let timer = RestTimer(run: 1, seconds: 90)
        let extended = RestSnapshot(endsAt: Self.start.addingTimeInterval(120), totalSeconds: 120)
        let next = timer.ticked(following: extended, at: Self.start.addingTimeInterval(1))
        #expect(next?.total == 120)
        #expect(next?.remaining == 119)
    }

    @Test func aTickNeverShowsMoreThanTheWallClockHasLeft() {
        let timer = RestTimer(run: 1, seconds: 90)
        let next = timer.ticked(following: Self.rest, at: Self.start.addingTimeInterval(60))
        #expect(next?.remaining == 30)
        #expect(timer.ticked(following: Self.rest, at: Self.start.addingTimeInterval(90)) == nil)
    }
}
