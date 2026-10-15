import Foundation
import Testing

@testable import LiftCore

@Suite struct ExerciseProgressTests {
    private static func set(_ reps: Int?, _ weight: Weight?, kind: SetKind = .working, done: Bool = true) -> LoggedSet {
        LoggedSet(
            id: TestCalendar.id(1),
            kind: kind,
            actual: done ? SetActual(reps: reps, weight: weight) : nil
        )
    }

    private static func session(_ id: UInt8, _ day: LocalDay, _ sets: [LoggedSet], loadMode: LoadMode = .total)
        -> ProgressSession
    {
        ProgressSession(id: TestCalendar.id(id), day: day, loadMode: loadMode, sets: sets)
    }

    private static let july = LocalDay(year: 2026, month: 7, day: 20)

    @Test func pointKeepsTheBestEstimateTheHeaviestSetAndTheTopSet() throws {
        let sets = [
            Self.set(10, .kg(40), kind: .warmUp),
            Self.set(5, .kg(100)),
            Self.set(3, .kg(110)),
            Self.set(8, .kg(90), done: false),
        ]
        let points = ExerciseProgress.points([Self.session(1, Self.july, sets)], unit: .kg)
        let point = try #require(points.first)
        #expect(points.count == 1)
        #expect(abs((point.estimate?.value ?? 0) - 121) < 0.001)
        #expect(point.heaviest == .kg(110))
        #expect(point.topSet == TopSet(reps: 3, weight: .kg(110)))
    }

    @Test func pointsAreOldestFirstInTheChartUnit() {
        let late = Self.session(1, Self.july.adding(days: 7), [Self.set(1, .lb(225))])
        let early = Self.session(2, Self.july, [Self.set(1, .kg(100))])
        let points = ExerciseProgress.points([late, early], unit: .kg)
        #expect(points.map(\.id) == [TestCalendar.id(2), TestCalendar.id(1)])
        #expect(points.allSatisfy { $0.estimate?.unit == .kg && $0.heaviest?.unit == .kg })
        #expect(abs((points.last?.estimate?.value ?? 0) - 102.058) < 0.01)
    }

    @Test func warmUpsGiveOnlyTheHeaviestWhenNothingElseWasLogged() {
        let warmUp = Self.session(1, Self.july, [Self.set(1, .kg(60), kind: .warmUp)])
        let points = ExerciseProgress.points([warmUp], unit: .kg)
        #expect(points.first?.estimate == nil)
        #expect(points.first?.heaviest == .kg(60))
        #expect(points.first?.topSet == TopSet(reps: 1, weight: .kg(60)))
    }

    @Test func sessionsWithoutLoadOrEstimateAreLeftOut() {
        let bodyweight = Self.session(1, Self.july, [Self.set(8, nil)], loadMode: .bodyweight(added: nil))
        let nothingDone = Self.session(2, Self.july, [Self.set(5, .kg(80), done: false)])
        #expect(ExerciseProgress.points([bodyweight, nothingDone], unit: .kg).isEmpty)
    }

    @Test func highRepSetsKeepTheirHeaviestWithoutAnEstimate() {
        let points = ExerciseProgress.points([Self.session(1, Self.july, [Self.set(15, .kg(40))])], unit: .kg)
        #expect(points.first?.estimate == nil)
        #expect(points.first?.heaviest == .kg(40))
    }

    @Test func summaryCountsTheChangeAcrossTheRange() {
        let sessions = [
            Self.session(1, LocalDay(year: 2026, month: 3, day: 2), [Self.set(1, .kg(80))]),
            Self.session(2, Self.july, [Self.set(1, .kg(90))]),
            Self.session(3, Self.july.adding(days: 30), [Self.set(1, .kg(100))]),
            Self.session(4, Self.july.adding(days: 60), [Self.set(1, .kg(96.5))]),
        ]
        let points = ExerciseProgress.points(sessions, unit: .kg)
        let today = LocalDay(year: 2026, month: 10, day: 15)

        let summary = ExerciseProgress.summary(points, range: .threeMonths, today: today)

        #expect(summary.points.map(\.id) == [2, 3, 4].map(TestCalendar.id))
        #expect(summary.best?.id == TestCalendar.id(3))
        #expect(summary.change == .kg(6.5))
        #expect(summary.since == Self.july)
        #expect(ExerciseProgress.summary(points, range: .all, today: today).change == .kg(16.5))
    }

    @Test func oneSessionHasABestButNoChange() {
        let points = ExerciseProgress.points([Self.session(1, Self.july, [Self.set(5, .kg(90))])], unit: .kg)
        let summary = ExerciseProgress.summary(points, range: .all, today: Self.july)
        #expect(summary.best?.estimate == .kg(105))
        #expect(summary.change == nil)
        #expect(summary.since == nil)
    }

    @Test func anEmptyRangeHasNothing() {
        let points = ExerciseProgress.points([Self.session(1, Self.july, [Self.set(5, .kg(90))])], unit: .kg)
        let summary = ExerciseProgress.summary(points, range: .threeMonths, today: Self.july.adding(days: 200))
        #expect(summary == ProgressSummary(points: [], best: nil, change: nil, since: nil))
    }
}
