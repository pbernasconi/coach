import Foundation

extension WorkoutOverview {
    /// What the rest Live Activity shows once `setID` is logged: its exercise and set title, and the next planned
    /// set ("Set 3 · 5 @ 100 kg", with the exercise name first when it is another exercise). Nil for an unknown set.
    func restActivity(afterLogging setID: UUID) -> (attributes: RestActivityAttributes, nextSetLabel: String?)? {
        let rows = exercises.flatMap { exercise in exercise.sets.map { (exercise: exercise, set: $0) } }
        guard let index = rows.firstIndex(where: { $0.set.id == setID }) else { return nil }
        let logged = rows[index]
        let later = rows[(index + 1)...] + rows[..<index]
        let next = later.first { $0.set.status == .planned }
        let nextLabel = next.map { row in
            let parts = row.exercise.id == logged.exercise.id ? [] : [row.exercise.name]
            return (parts + [row.set.title, row.set.target]).joined(separator: " · ")
        }
        return (RestActivityAttributes(exerciseName: logged.exercise.name, setLabel: logged.set.title), nextLabel)
    }
}
