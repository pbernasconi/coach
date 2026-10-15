import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@Suite struct DemoSeederTests {
    private static let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC") ?? calendar.timeZone
        return calendar
    }()

    private func seeded() async throws -> (TestStore, [SessionDetail]) {
        let store = try TestStore.make()
        let seeder = DemoSeeder(
            exercises: store.exercises,
            sessions: store.sessions,
            sets: store.sets,
            templates: store.templates,
            plans: store.plans
        )
        let ids = try await seeder.seed(today: Fixtures.monday, calendar: Self.calendar)
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

    @Test func upperAAndLowerATemplatesPlanEverySession() async throws {
        let (store, details) = try await seeded()
        var stream = store.templates.observeTemplates().makeAsyncIterator()
        let templates = await stream.next() ?? []
        #expect(templates.map(\.name) == ["Upper A", "Lower A"])
        #expect(templates.map(\.exercises.count) == [3, 3])
        let byName = Dictionary(uniqueKeysWithValues: templates.map { ($0.name, $0.id) })
        #expect(details.allSatisfy { $0.session.templateID == byName[$0.session.title] })
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

    @Test func pastSessionsAreFinishedWithMadeUpTimesOnTheirDay() async throws {
        let (_, details) = try await seeded()
        let past = details.filter { $0.session.day < Fixtures.monday }
        for detail in past {
            let start = try #require(detail.session.startedAt)
            let finish = try #require(detail.session.finishedAt)
            #expect(LocalDay(start, calendar: Self.calendar) == detail.session.day)
            #expect((35 * 60...70 * 60).contains(finish.timeIntervalSince(start)))
            let stamps = detail.items.flatMap(\.sets).compactMap(\.completedAt)
            #expect(stamps.count == detail.items.flatMap(\.sets).count)
            #expect(stamps == stamps.sorted())
            #expect(stamps.allSatisfy { $0 > start && $0 < finish })
        }
        let summary = WorkoutSummarizer.summarize(try #require(past.last).domain, earlier: [:], unit: .kg)
        #expect((summary.duration ?? 0) > 35 * 60)
    }
}
