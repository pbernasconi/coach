import Foundation

@testable import Lift

/// A Health store in memory: an authorization that `requestAuthorization` moves to `answer`, and the saved workouts.
@MainActor
final class FakeHealthWorkoutStore: HealthWorkoutStore {
    var authorizationValue: HealthAuthorization
    /// What the permission sheet answers.
    var answer: HealthAuthorization = .authorized
    var saveError: (any Error)?
    private(set) var requestCount = 0
    private(set) var saved: [UUID: HealthWorkout] = [:]
    private(set) var deleted: [UUID] = []
    private var nextNumber: UInt8 = 0

    init(authorization: HealthAuthorization) {
        authorizationValue = authorization
    }

    func authorization() -> HealthAuthorization { authorizationValue }

    func requestAuthorization() async throws {
        requestCount += 1
        if authorizationValue == .notDetermined { authorizationValue = answer }
    }

    func save(_ workout: HealthWorkout) async throws -> UUID {
        if let saveError { throw saveError }
        nextNumber += 1
        let id = UUID(uuid: (0xEE, 0, 0, 0, 0, 0, 0x40, 0, 0x80, 0, 0, 0, 0, 0, 0, nextNumber))
        saved[id] = workout
        return id
    }

    func delete(workoutID: UUID) async throws {
        deleted.append(workoutID)
        saved[workoutID] = nil
    }
}

/// The Health preference in memory.
@MainActor
final class InMemoryHealthSettings: HealthSettingsStoring {
    var savesWorkouts = true
}
