#if DEBUG
    import Foundation
    import KoboPatterns

    /// Named states for previews and the demo gallery. Fake data only (TEST-8).
    extension TrainingState {
        static var fixtureActivities: TrainingState {
            var state = TrainingState(segment: .activities)
            state.list = TrainingSamples.loaded(TrainingSamples.activities)
            state.nextCursor = state.list.content.value?.nextCursor
            state.footer = LoadMoreFooterModel().pageLoaded(loadedCount: state.rows.count, hasMore: true)
            return state
        }

        static var fixtureTrends: TrainingState {
            var state = fixtureActivities
            state.segment = .trends
            state.trends = TrainingSamples.loaded(TrainingSamples.trends)
            return state
        }

        static var fixtureLoading: TrainingState { TrainingState(segment: .activities) }

        static var fixtureFailed: TrainingState {
            var state = TrainingState(segment: .activities)
            state.list.content = .failed(message: "Coach could not be reached. Pull down to try again.")
            return state
        }

        static var fixtureNotConnected: TrainingState {
            var state = TrainingState(segment: .trends)
            state.trends.content = .empty
            return state
        }

        static var fixturePageFailed: TrainingState {
            var state = fixtureActivities
            state.footer = state.footer.loadStarted().loadFailed()
            return state
        }
    }
#endif
