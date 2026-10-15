import Foundation
import Testing

@testable import LiftCore

@Suite struct WeeklyVolumeTests {
    private static func session(_ exercises: [SessionExercise], deleted: Bool = false) -> Session {
        let date = TestCalendar.date(2026, 3, 2)
        return Session(
            id: TestCalendar.id(1),
            date: LocalDay(year: 2026, month: 3, day: 2),
            title: "Lower",
            exercises: exercises,
            unitsAtLog: .lb,
            createdAt: date,
            updatedAt: date,
            deletedAt: deleted ? date : nil
        )
    }

    private static func exercise(_ number: UInt8?, _ sets: [LoggedSet]) -> SessionExercise {
        SessionExercise(
            id: TestCalendar.id(2),
            exerciseID: number.map(ExerciseLibrary.seedID),
            displayName: "x",
            loadMode: .total,
            sets: sets
        )
    }

    @Test func countsPrimaryAsOneAndSecondaryAsHalf() {
        let squat = Self.exercise(
            1,
            [
                TestCalendar.done(10, .lb(45), kind: .warmUp),
                TestCalendar.done(5, .lb(225)),
                TestCalendar.done(5, .lb(225), kind: .failure),
                TestCalendar.done(8, .lb(185), kind: .drop),
                LoggedSet(id: TestCalendar.id(5), target: SetTarget(reps: 5), isSkipped: true),
            ]
        )
        let unknown = Self.exercise(nil, [TestCalendar.done(10, .lb(20))])
        let volume = WeeklyVolume.volume(sessions: [Self.session([squat, unknown])], library: ExerciseLibrary.seed)
        let byMuscle = Dictionary(uniqueKeysWithValues: volume.map { ($0.muscle, $0.hardSets) })
        #expect(volume.map(\.muscle) == Muscle.allCases)
        #expect(byMuscle[.quads] == 3)
        #expect(byMuscle[.glutes] == 3)
        #expect(byMuscle[.hamstrings] == 1.5)
        #expect(byMuscle[.core] == 1.5)
        #expect(byMuscle[.chest] == 0)
    }

    @Test func ignoresDeletedSessionsAndEmptyInput() {
        let bench = Self.exercise(5, Array(repeating: TestCalendar.done(5, .lb(135)), count: 12))
        let volume = WeeklyVolume.volume(
            sessions: [Self.session([bench], deleted: true)],
            library: ExerciseLibrary.seed
        )
        #expect(volume.allSatisfy { $0.hardSets == 0 && $0.status == .below })
        #expect(WeeklyVolume.volume(sessions: [], library: []).count == Muscle.allCases.count)
    }

    @Test func statusAgainstTheBand() {
        let bench = Self.exercise(5, Array(repeating: TestCalendar.done(5, .lb(135)), count: 12))
        let volume = WeeklyVolume.volume(sessions: [Self.session([bench])], library: ExerciseLibrary.seed)
        let chest = volume.first { $0.muscle == .chest }
        #expect(chest == MuscleVolume(muscle: .chest, hardSets: 12, status: .inRange))
        #expect(volume.first { $0.muscle == .triceps }?.status == .below)
    }

    @Test(arguments: [
        (0.0, VolumeStatus.below), (9.5, .below), (10, .inRange), (15, .inRange), (20, .inRange), (20.5, .above),
    ])
    func status(sets: Double, expected: VolumeStatus) {
        #expect(WeeklyVolume.status(forHardSets: sets) == expected)
        #expect(WeeklyVolume.targetSets == 10...20)
    }
}
