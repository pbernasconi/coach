import Foundation
import GRDB

/// The ids one scenario wrote, per synced table.
struct E2EIDs: Sendable {
    var exercises: Set<UUID> = []
    var sessions: Set<UUID> = []
    var sessionExercises: Set<UUID> = []
    var sets: Set<UUID> = []
    var templates: Set<UUID> = []
    var templateExercises: Set<UUID> = []
    /// A set `writeWorkout` leaves live and logged.
    var liveSet: UUID?

    var count: Int {
        exercises.count + sessions.count + sessionExercises.count + sets.count + templates.count
            + templateExercises.count
    }

    func contains(_ id: UUID) -> Bool {
        [exercises, sessions, sessionExercises, sets, templates, templateExercises].contains { $0.contains(id) }
    }
}

struct E2ESnapshot: Equatable {
    var exercises: [UUID: [String: DatabaseValue]]
    var sessions: [UUID: [String: DatabaseValue]]
    var sessionExercises: [UUID: [String: DatabaseValue]]
    var sets: [UUID: [String: DatabaseValue]]
    var templates: [UUID: [String: DatabaseValue]] = [:]
    var templateExercises: [UUID: [String: DatabaseValue]] = [:]

    var count: Int {
        exercises.count + sessions.count + sessionExercises.count + sets.count + templates.count
            + templateExercises.count
    }

    /// What differs from `expected`, table by table, for a failure message: missing rows and differing columns.
    func differences(from expected: E2ESnapshot) -> String {
        var lines: [String] = []
        func compare(
            _ table: String,
            _ mine: [UUID: [String: DatabaseValue]],
            _ theirs: [UUID: [String: DatabaseValue]]
        ) {
            for (id, row) in theirs {
                guard let other = mine[id] else {
                    lines.append("\(table) \(id) missing")
                    continue
                }
                for (column, value) in row where other[column] != value {
                    lines.append(
                        "\(table) \(id).\(column): \(other[column].map(String.init(describing:)) ?? "nil") != \(value)"
                    )
                }
            }
            for id in mine.keys where theirs[id] == nil { lines.append("\(table) \(id) unexpected") }
        }
        compare("exercise", exercises, expected.exercises)
        compare("session", sessions, expected.sessions)
        compare("sessionExercise", sessionExercises, expected.sessionExercises)
        compare("workoutSet", sets, expected.sets)
        compare("template", templates, expected.templates)
        compare("templateExercise", templateExercises, expected.templateExercises)
        return lines.prefix(20).joined(separator: "\n") + (lines.count > 20 ? "\n… \(lines.count) in all" : "")
    }
}
