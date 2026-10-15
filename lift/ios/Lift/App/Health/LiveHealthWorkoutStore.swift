import Foundation
import HealthKit
import LiftCore

/// `HealthWorkoutStore` over HealthKit. Lift asks to share workouts only and reads nothing (PLAT-3).
final class LiveHealthWorkoutStore: HealthWorkoutStore {
    func authorization() -> HealthAuthorization {
        guard HKHealthStore.isHealthDataAvailable() else { return .unavailable }
        switch HKHealthStore().authorizationStatus(for: HKObjectType.workoutType()) {
        case .notDetermined: return .notDetermined
        case .sharingAuthorized: return .authorized
        case .sharingDenied: return .denied
        @unknown default: return .denied
        }
    }

    func requestAuthorization() async throws {
        try await HealthKitCalls.requestWorkoutSharing()
    }

    func save(_ workout: HealthWorkout) async throws -> UUID {
        try await HealthKitCalls.save(workout)
    }

    func delete(workoutID: UUID) async throws {
        try await HealthKitCalls.delete(workoutID: workoutID)
    }
}

/// The HealthKit calls, off the main actor. Each makes its own `HKHealthStore` and `HKWorkoutBuilder`, so no
/// HealthKit object crosses an isolation boundary.
nonisolated enum HealthKitCalls {
    /// Lift's own metadata key for the session title (custom keys must not start with "HK").
    static let titleKey = "LiftSessionTitle"

    @concurrent static func requestWorkoutSharing() async throws {
        try await HKHealthStore().requestAuthorization(toShare: [HKObjectType.workoutType()], read: [])
    }

    /// Builds the workout with `HKWorkoutBuilder`: strength training indoors, from the session's start to its finish,
    /// tagged with the session id (so it can be found again) and its title. No samples and no energy.
    @concurrent static func save(_ workout: HealthWorkout) async throws -> UUID {
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .traditionalStrengthTraining
        configuration.locationType = .indoor
        let store = HKHealthStore()
        let builder = HKWorkoutBuilder(healthStore: store, configuration: configuration, device: .local())
        try await builder.beginCollection(at: workout.start)
        try await builder.addMetadata([
            HKMetadataKeyExternalUUID: workout.sessionID.uuidString,
            HKMetadataKeyIndoorWorkout: true,
            titleKey: workout.title,
        ])
        try await builder.endCollection(at: workout.end)
        let saved: HKWorkout? = try await builder.finishWorkout()
        guard let saved else { throw AppError(.unknown, detail: "Health saved no workout") }
        return saved.uuid
    }

    /// Deletes the workout with `workoutID`; HealthKit only deletes what Lift saved.
    @concurrent static func delete(workoutID: UUID) async throws {
        let predicate = HKQuery.predicateForObject(with: workoutID)
        _ = try await HKHealthStore().deleteObjects(of: HKObjectType.workoutType(), predicate: predicate)
    }
}
