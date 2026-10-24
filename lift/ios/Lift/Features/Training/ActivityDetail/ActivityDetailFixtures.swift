#if DEBUG
    import Foundation
    import KoboPatterns
    import LiftSync

    /// Named states for previews and the demo gallery. Fake data only (TEST-8).
    extension ActivityDetailState {
        static var fixtureRun: ActivityDetailState {
            ActivityDetailState(ref: "strava-9000000102", detail: TrainingSamples.loaded(TrainingSamples.run))
        }

        static var fixtureRunByTime: ActivityDetailState {
            var state = fixtureRun
            state.axis = .time
            state.paceMode = "smoothed"
            return state
        }

        static var fixtureRide: ActivityDetailState {
            ActivityDetailState(ref: "strava-9000000103", detail: TrainingSamples.loaded(TrainingSamples.ride))
        }

        static var fixturePending: ActivityDetailState {
            ActivityDetailState(ref: "strava-9000000104", detail: TrainingSamples.loaded(TrainingSamples.pending))
        }

        /// The demo's planned ride, with the pencil's Edit sheet open.
        static var fixturePlannedEdit: ActivityDetailState {
            var state = ActivityDetailState(ref: "plan-demo-ride")
            let plan: AppPlannedWorkout? = TrainingSamples.decode("app-plan-id")
            let workout = plan.map { WorkoutDetail(ref: "plan-demo-ride", state: "planned", title: $0.title, plan: $0) }
            state.workout = TrainingSamples.loaded(workout)
            state.openEdit()
            return state
        }

        static var fixtureLoading: ActivityDetailState { ActivityDetailState(ref: "strava-9000000102") }

        static var fixtureFailed: ActivityDetailState {
            var state = ActivityDetailState(ref: "strava-9000000102")
            state.workout.content = .failed(message: "Coach has nothing here.")
            return state
        }
    }
#endif
