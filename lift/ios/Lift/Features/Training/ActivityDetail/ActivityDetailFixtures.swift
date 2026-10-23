#if DEBUG
    import Foundation
    import KoboPatterns

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

        static var fixtureLoading: ActivityDetailState { ActivityDetailState(ref: "strava-9000000102") }

        static var fixtureFailed: ActivityDetailState {
            var state = ActivityDetailState(ref: "strava-9000000102")
            state.workout.content = .failed(message: "Coach has nothing here.")
            return state
        }
    }
#endif
