import Foundation
import Testing

@testable import LiftCore

/// The finish summary's numbers (TEST-4): made-up sessions only.
@Suite struct WorkoutSummarizerTests {
    private static let start = TestCalendar.date(2026, 3, 2)
    private static let squatID = TestCalendar.id(20)
    private static let curlID = TestCalendar.id(21)

    private static func set(
        _ reps: Int,
        _ weight: Weight?,
        minute: Double,
        kind: SetKind = .working,
        done: Bool = true
    ) -> LoggedSet {
        LoggedSet(
            id: TestCalendar.id(1),
            kind: kind,
            target: SetTarget(reps: reps, weight: weight),
            actual: done
                ? SetActual(reps: reps, weight: weight, completedAt: start.addingTimeInterval(minute * 60)) : nil
        )
    }

    private static func session(_ exercises: [SessionExercise], started: Date? = nil, finished: Date? = nil) -> Session
    {
        Session(
            id: TestCalendar.id(10),
            date: LocalDay(year: 2026, month: 3, day: 2),
            title: "Lower A",
            exercises: exercises,
            startedAt: started,
            finishedAt: finished,
            unitsAtLog: .kg,
            createdAt: start,
            updatedAt: start
        )
    }

    private static func exercise(_ id: UUID, _ sets: [LoggedSet], loadMode: LoadMode = .total) -> SessionExercise {
        SessionExercise(
            id: TestCalendar.id(30),
            exerciseID: id,
            displayName: "Made-up lift",
            loadMode: loadMode,
            sets: sets
        )
    }

    @Test func countsSetsVolumeAndDuration() {
        let squat = Self.exercise(
            Self.squatID,
            [
                Self.set(5, .kg(40), minute: 0, kind: .warmUp),
                Self.set(5, .kg(100), minute: 5),
                Self.set(5, .kg(100), minute: 9),
                Self.set(5, .kg(100), minute: 13, done: false),
            ]
        )
        let curl = Self.exercise(Self.curlID, [Self.set(10, .kg(12), minute: 20)], loadMode: .perHand)
        let summary = WorkoutSummarizer.summarize(
            Self.session([squat, curl], finished: Self.start.addingTimeInterval(30 * 60)),
            earlier: [:],
            unit: .kg
        )
        #expect(summary.setsLogged == 4)
        // 2 × 5 × 100 + 10 × 12 × 2 (two dumbbells); the warm-up and the planned set do not count.
        #expect(summary.volume == .kg(1_240))
        #expect(abs((summary.duration ?? 0) - 30 * 60) < 0.001)
        #expect(summary.bests.isEmpty)
    }

    @Test(arguments: [
        (WeightUnit.kg, LoadMode.total, 500.0),
        (.lb, .total, 1_102.31),
        (.kg, .perSide, 1_000),
        (.kg, .bodyweight(added: nil), 500),
    ])
    func volumeOfOneSet(unit: WeightUnit, loadMode: LoadMode, expected: Double) {
        let volume = WorkoutSummarizer.volume(of: Self.set(5, .kg(100), minute: 0), loadMode: loadMode, unit: unit)
        #expect(abs(volume - expected) < 0.01)
    }

    @Test func noLoggedSetsMeansNoDuration() {
        let squat = Self.exercise(Self.squatID, [Self.set(5, .kg(100), minute: 0, done: false)])
        let summary = WorkoutSummarizer.summarize(Self.session([squat]), earlier: [:], unit: .kg)
        #expect(summary.duration == nil)
        #expect(summary.setsLogged == 0)
        #expect(summary.volume == .kg(0))
    }

    @Test func beatingEarlierSetsIsOneBestPerExercise() throws {
        let squat = Self.exercise(Self.squatID, [Self.set(5, .kg(100), minute: 0), Self.set(5, .kg(105), minute: 4)])
        let curl = Self.exercise(Self.curlID, [Self.set(8, .kg(12), minute: 8)])
        let earlier = [
            Self.squatID: [Self.set(5, .kg(100), minute: 0)],
            Self.curlID: [Self.set(12, .kg(12), minute: 0)],
        ]
        let summary = WorkoutSummarizer.summarize(Self.session([squat, curl]), earlier: earlier, unit: .kg)
        let best = try #require(summary.bests.first)
        #expect(summary.bests.count == 1)
        #expect(best.exerciseID == Self.squatID)
        #expect(best.heaviest == PersonalBest.Record(value: .kg(105), previous: .kg(100)))
        // 105 × (1 + 5/30) = 122.5; 100 × (1 + 5/30) = 116.67, rounded to 116.5.
        #expect(best.estimatedOneRepMax == PersonalBest.Record(value: .kg(122.5), previous: .kg(116.5)))
        #expect(best.topSet == PersonalBest.TopSet(weight: .kg(105), reps: 5))
        #expect(best.estimate == .kg(122.5))
    }

    @Test func aFirstTimeIsNotABest() {
        let squat = Self.exercise(Self.squatID, [Self.set(5, .kg(105), minute: 0)])
        let summary = WorkoutSummarizer.summarize(Self.session([squat]), earlier: [Self.squatID: []], unit: .kg)
        #expect(summary.bests.isEmpty)
    }

    @Test func theStartStampWinsOverTheFirstSet() {
        let squat = Self.exercise(Self.squatID, [Self.set(5, .kg(100), minute: 10)])
        let session = Self.session(
            [squat],
            started: Self.start,
            finished: Self.start.addingTimeInterval(45 * 60)
        )
        let duration = WorkoutSummarizer.summarize(session, earlier: [:], unit: .kg).duration
        #expect(abs((duration ?? 0) - 45 * 60) < 0.001)
    }
}
