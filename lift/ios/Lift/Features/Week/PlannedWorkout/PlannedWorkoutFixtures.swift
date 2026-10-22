#if DEBUG
    import Foundation
    import LiftSync

    /// Named states for previews: the bundled demo body (made up, TEST-8).
    extension PlannedWorkoutState {
        static var fixtureDefault: PlannedWorkoutState {
            PlannedWorkoutState(
                workout: AppResourceState(
                    content: PlannedWorkoutDemoBody.value.map { .loaded($0) } ?? .loading,
                    freshness: AppFreshness(text: "Updated 9:41 AM", isOffline: false)
                )
            )
        }
        static var fixtureDone: PlannedWorkoutState {
            let done = PlannedWorkoutDemoBody.value.map { body in
                var done = body
                done.state = "done"
                done.stateLabel = "Done"
                done.compliance = "good"
                done.done = PlannedDone(activityId: "9000000103", name: "Morning Ride")
                return done
            }
            return PlannedWorkoutState(workout: AppResourceState(content: done.map { .loaded($0) } ?? .loading))
        }
        static var fixtureNoSteps: PlannedWorkoutState {
            let plain = PlannedWorkoutDemoBody.value.map { body in
                var plain = body
                plain.workout = nil
                plain.intensity = "Easy: talk the whole way"
                return plain
            }
            return PlannedWorkoutState(workout: AppResourceState(content: plain.map { .loaded($0) } ?? .loading))
        }
        static let fixtureLoading = PlannedWorkoutState()
        static let fixtureNotConnected = PlannedWorkoutState(workout: AppResourceState(content: .empty))
        static let fixtureFailed = PlannedWorkoutState(
            workout: AppResourceState(content: .failed(message: "Coach has nothing here."))
        )
    }

    /// The bundled demo body (Resources/DemoAPI/app-plan-id.json), decoded for previews.
    enum PlannedWorkoutDemoBody {
        static var value: AppPlannedWorkout? {
            guard let url = Bundle.main.url(forResource: "app-plan-id", withExtension: "json"),
                let data = try? Data(contentsOf: url)
            else { return nil }
            return try? JSONDecoder().decode(AppPlannedWorkout.self, from: data)
        }
    }
#endif
