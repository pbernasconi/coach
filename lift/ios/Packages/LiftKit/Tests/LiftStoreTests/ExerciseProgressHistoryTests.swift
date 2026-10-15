import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

/// The progress chart's read: every logged session of an exercise through `observeHistory`, as `ExerciseProgress`
/// points.
@Suite struct ExerciseProgressHistoryTests {
    @Test func everyLoggedSessionBecomesAPointOldestFirst() async throws {
        let store = try TestStore.make()
        var ids: [UUID] = []
        for week in 0..<12 {
            let weight = Weight.kg(80 + 2.5 * Double(week))
            let day = Fixtures.monday.adding(days: 7 * week)
            ids.append(try await store.loggedSquats(reps: [5, 5, 5], weight: weight, on: day).id)
        }

        var stream = store.sessions.observeHistory(exerciseID: Fixtures.squat.id, limit: 1_000).makeAsyncIterator()
        let entries = try #require(await stream.next())
        let points = ExerciseProgress.points(entries.map(\.progressSession), unit: .kg)

        #expect(entries.count == 12)
        #expect(points.map(\.id) == ids)
        #expect(points.first?.day == Fixtures.monday)
        #expect(points.first?.heaviest == .kg(80))
        #expect(points.last?.topSet == TopSet(reps: 5, weight: .kg(107.5)))
    }

    @Test func progressSessionKeepsTheStampedLoadModeAndLoggedSets() async throws {
        let store = try TestStore.make()
        let session = try await store.loggedSquats(reps: [5, 3], weight: .kg(100))

        var stream = store.sessions.observeHistory(exerciseID: Fixtures.squat.id, limit: 1).makeAsyncIterator()
        let progress = try #require(await stream.next()?.first?.progressSession)

        #expect(progress.id == session.id)
        #expect(progress.day == Fixtures.monday)
        #expect(progress.loadMode == .total)
        #expect(progress.sets.map(\.actual?.reps) == [5, 3])
        let allDone = progress.sets.allSatisfy(\.isDone)
        #expect(allDone)
    }
}
