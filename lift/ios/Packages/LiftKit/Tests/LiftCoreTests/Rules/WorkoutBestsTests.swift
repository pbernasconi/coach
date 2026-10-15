import Foundation
import Testing

@testable import LiftCore

/// One record row per exercise in the finish summary (TEST-4): made-up sets only.
@Suite struct WorkoutBestsTests {
    private static let benchID = TestCalendar.id(40)

    private static func done(_ reps: Int, _ weight: Weight?, kind: SetKind = .working) -> LoggedSet {
        TestCalendar.done(reps, weight, kind: kind)
    }

    private static func session(_ sets: [LoggedSet], loadMode: LoadMode = .total, split: Bool = false) -> Session {
        let exercise = { (sets: [LoggedSet], id: UInt8) in
            SessionExercise(
                id: TestCalendar.id(id),
                exerciseID: benchID,
                displayName: "Bench press",
                loadMode: loadMode,
                sets: sets
            )
        }
        let exercises =
            split ? [exercise(Array(sets.prefix(1)), 50), exercise(Array(sets.dropFirst()), 51)] : [exercise(sets, 50)]
        return Session(
            id: TestCalendar.id(10),
            date: LocalDay(year: 2026, month: 3, day: 2),
            title: "Upper A",
            exercises: exercises,
            unitsAtLog: .kg,
            createdAt: TestCalendar.date(2026, 3, 2),
            updatedAt: TestCalendar.date(2026, 3, 2)
        )
    }

    private static func bests(_ sets: [LoggedSet], before: [LoggedSet], unit: WeightUnit = .kg) -> [PersonalBest] {
        WorkoutBests.bests(session(sets), earlier: [benchID: before], unit: unit)
    }

    @Test func aHeavierSetAndAHigherEstimateMakeOneRow() throws {
        let bests = Self.bests([Self.done(5, .kg(60)), Self.done(5, .kg(65))], before: [Self.done(5, .kg(62.5))])
        let best = try #require(bests.first)
        #expect(bests.count == 1)
        #expect(best.heaviest == PersonalBest.Record(value: .kg(65), previous: .kg(62.5)))
        // 65 × (1 + 5/30) = 75.83 → 76; 62.5 × (1 + 5/30) = 72.92 → 73.
        #expect(best.estimatedOneRepMax == PersonalBest.Record(value: .kg(76), previous: .kg(73)))
        #expect(best.topSet == PersonalBest.TopSet(weight: .kg(65), reps: 5))
    }

    @Test func anEstimateRecordWithoutAHeavierSetShowsTheSetBehindIt() throws {
        let bests = Self.bests([Self.done(10, .kg(60)), Self.done(3, .kg(62.5))], before: [Self.done(5, .kg(65))])
        let best = try #require(bests.first)
        #expect(best.heaviest == nil)
        // 60 × (1 + 10/30) = 80 beats 75.83 → 76.
        #expect(best.estimatedOneRepMax == PersonalBest.Record(value: .kg(80), previous: .kg(76)))
        #expect(best.topSet == PersonalBest.TopSet(weight: .kg(60), reps: 10))
        #expect(best.estimate == .kg(80))
    }

    @Test func aHeavierSetWithALowerEstimateIsStillABest() throws {
        let bests = Self.bests([Self.done(1, .kg(70))], before: [Self.done(8, .kg(60))])
        let best = try #require(bests.first)
        #expect(best.heaviest == PersonalBest.Record(value: .kg(70), previous: .kg(60)))
        #expect(best.estimatedOneRepMax == nil)
        #expect(best.estimate == .kg(70))
    }

    @Test func roundingNoiseIsNotARecord() {
        // 61 × 1.2 = 73.2 and 62.5 × 7/6 = 72.92 both round to 73, and 61 kg is lighter: no record.
        #expect(Self.bests([Self.done(5, .kg(62.5))], before: [Self.done(5, .kg(62.5))]).isEmpty)
        #expect(Self.bests([Self.done(6, .kg(61))], before: [Self.done(5, .kg(62.5))]).isEmpty)
    }

    @Test func warmUpsAndPlannedSetsNeverCount() {
        var planned = Self.done(5, .kg(100))
        planned.actual = nil
        let sets = [Self.done(1, .kg(90), kind: .warmUp), planned, Self.done(5, .kg(60))]
        #expect(Self.bests(sets, before: [Self.done(5, .kg(62.5))]).isEmpty)
    }

    @Test func anExerciseSplitInTwoSlotsIsOneRow() {
        let sets = [Self.done(5, .kg(65)), Self.done(5, .kg(67.5))]
        let bests = WorkoutBests.bests(
            Self.session(sets, split: true),
            earlier: [Self.benchID: [Self.done(5, .kg(62.5))]],
            unit: .kg
        )
        #expect(bests.count == 1)
        #expect(bests.first?.topSet == PersonalBest.TopSet(weight: .kg(67.5), reps: 5))
    }

    @Test func estimatesRoundInTheSummaryUnit() throws {
        let best = try #require(Self.bests([Self.done(5, .lb(150))], before: [Self.done(5, .kg(60))], unit: .lb).first)
        // 150 lb × 7/6 = 175 lb; 60 kg × 7/6 = 70 kg = 154.32 lb → 154.5.
        #expect(best.estimatedOneRepMax == PersonalBest.Record(value: .lb(175), previous: .lb(154.5)))
    }

    @Test func aBodyweightSetShowsItsAddedLoad() throws {
        let bests = Self.bests(
            [Self.done(6, .kg(10))],
            before: [Self.done(6, .kg(5))],
            unit: .kg
        )
        let session = Self.session([Self.done(8, nil)], loadMode: .bodyweight(added: .kg(12.5)))
        let added = WorkoutBests.bests(session, earlier: [Self.benchID: [Self.done(8, .kg(10))]], unit: .kg)
        #expect(bests.first?.topSet == PersonalBest.TopSet(weight: .kg(10), reps: 6))
        #expect(try #require(added.first).topSet == PersonalBest.TopSet(weight: .kg(12.5), reps: 8))
    }
}
