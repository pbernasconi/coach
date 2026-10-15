import Foundation
import Testing

@testable import LiftCore

@Suite struct WeeklyVolumeWeeksTests {
    private static let monday = LocalDay(year: 2026, month: 3, day: 2)

    private static func session(_ day: LocalDay, _ exercises: [SessionExercise]) -> Session {
        let date = TestCalendar.date(2026, 3, 2)
        return Session(
            id: TestCalendar.id(1),
            date: day,
            title: "Full body",
            exercises: exercises,
            unitsAtLog: .kg,
            createdAt: date,
            updatedAt: date
        )
    }

    private static func exercise(_ number: UInt8?, sets: Int, warmUps: Int = 0) -> SessionExercise {
        let working = Array(repeating: TestCalendar.done(5, .kg(60)), count: sets)
        let warm = Array(repeating: TestCalendar.done(5, .kg(20), kind: .warmUp), count: warmUps)
        return SessionExercise(
            id: TestCalendar.id(2),
            exerciseID: number.map(ExerciseLibrary.seedID),
            displayName: "x",
            loadMode: .total,
            sets: warm + working
        )
    }

    @Test func groupsSessionsIntoTheirWeeks() {
        let sessions = [
            Self.session(Self.monday.adding(days: -8), [Self.exercise(5, sets: 4)]),
            Self.session(Self.monday.adding(days: -1), [Self.exercise(5, sets: 3)]),
            Self.session(Self.monday, [Self.exercise(5, sets: 2, warmUps: 2), Self.exercise(nil, sets: 1)]),
            Self.session(Self.monday.adding(days: 6), [Self.exercise(5, sets: 1)]),
            Self.session(Self.monday.adding(days: 7), [Self.exercise(5, sets: 9)]),
        ]
        let starts = [Self.monday.adding(days: -7), Self.monday]

        let weeks = WeeklyVolume.weeks(sessions: sessions, library: ExerciseLibrary.seed, starts: starts)

        #expect(weeks.map(\.start) == starts)
        #expect(weeks.map(\.hardSets) == [3, 4])
        let chest = weeks.map { $0.muscles.first { $0.muscle == .chest }?.hardSets }
        #expect(chest == [3, 3])
        #expect(weeks[1].muscles.first { $0.muscle == .triceps }?.hardSets == 1.5)
        #expect(weeks.allSatisfy { $0.muscles.map(\.muscle) == Muscle.allCases })
    }

    @Test func emptyWeeksStillListEveryMuscle() {
        let weeks = WeeklyVolume.weeks(sessions: [], library: ExerciseLibrary.seed, starts: [Self.monday])
        #expect(weeks.first?.hardSets == 0)
        #expect(weeks.first?.muscles.allSatisfy { $0.hardSets == 0 && $0.status == .below } == true)
    }

    @Test func contributionsListTheExercisesBehindAMuscle() {
        let sessions = [
            Self.session(Self.monday, [Self.exercise(1, sets: 3), Self.exercise(3, sets: 3)]),
            Self.session(
                Self.monday.adding(days: 3),
                [Self.exercise(1, sets: 2, warmUps: 3), Self.exercise(5, sets: 3)]
            ),
        ]

        let hamstrings = WeeklyVolume.contributions(to: .hamstrings, sessions: sessions, library: ExerciseLibrary.seed)

        #expect(hamstrings.map(\.name) == ["Romanian deadlift", "Back squat"])
        #expect(hamstrings.map(\.hardSets) == [3, 5])
        #expect(hamstrings.map(\.credit) == [3, 2.5])
        #expect(hamstrings.map(\.isPrimary) == [true, false])
        #expect(WeeklyVolume.contributions(to: .calves, sessions: sessions, library: ExerciseLibrary.seed).isEmpty)
    }

    @Test func contributionTiesSortByName() {
        let sessions = [Self.session(Self.monday, [Self.exercise(3, sets: 2), Self.exercise(1, sets: 2)])]
        let glutes = WeeklyVolume.contributions(to: .glutes, sessions: sessions, library: ExerciseLibrary.seed)
        #expect(glutes.map(\.name) == ["Back squat", "Romanian deadlift"])
    }
}
