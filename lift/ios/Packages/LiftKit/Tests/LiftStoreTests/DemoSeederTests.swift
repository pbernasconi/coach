import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@Suite struct DemoSeederTests {
    private func seeded() async throws -> (TestStore, [SessionDetail]) {
        let store = try TestStore.make()
        let seeder = DemoSeeder(exercises: store.exercises, sessions: store.sessions, sets: store.sets)
        let ids = try await seeder.seed(today: Fixtures.monday)
        var stream = store.sessions.observeSessions(
            from: Fixtures.monday.adding(days: -30),
            through: Fixtures.monday.adding(days: 30)
        )
        .makeAsyncIterator()
        let details = await stream.next() ?? []
        #expect(details.map(\.id) == ids)
        return (store, details)
    }

    @Test func pastSessionsAreLoggedAndUpcomingOnesArePlanned() async throws {
        let (_, details) = try await seeded()
        #expect(details.count == 8)
        let past = details.filter { $0.session.day < Fixtures.monday }
        let upcoming = details.filter { $0.session.day > Fixtures.monday }
        #expect(past.count == 6)
        #expect(upcoming.count == 2)
        #expect(past.allSatisfy { $0.domain.allSets.allSatisfy(\.isDone) })
        #expect(upcoming.allSatisfy { $0.domain.allSets.allSatisfy { $0.actual == nil } })
    }

    @Test func titlesAreGenericTrainingDays() async throws {
        let (_, details) = try await seeded()
        #expect(Set(details.map(\.session.title)) == ["Lower A", "Upper A"])
    }

    @Test func loadsRiseWeekOverWeek() async throws {
        let (_, details) = try await seeded()
        let squatLoads = details.compactMap { detail in
            detail.items.first { $0.exercise.exerciseID == Fixtures.squat.id }?.sets.first?.target.weight?.value
        }
        #expect(squatLoads == [80, 82.5, 85, 87.5])
    }

    @Test func thisWeekHasTwoPlannedSessionsTowardTheMinimum() async throws {
        let (_, details) = try await seeded()
        let week = details.filter {
            $0.session.day >= Fixtures.monday && $0.session.day <= Fixtures.monday.adding(days: 6)
        }
        let progress = WeekPlan.progress(sessions: week.map(\.domain))
        #expect(progress.done == 0)
        #expect(progress.planned == 2)
    }
}
