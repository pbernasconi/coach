#if DEBUG
    import Foundation
    import KoboPatterns
    import LiftSync

    /// Named states for previews, from the bundled made-up demo body (TEST-8).
    extension LiftSessionState {
        /// The demo session: done, three exercises, a skipped set and one first-time exercise.
        static let fixtureDefault: LiftSessionState = {
            var state = LiftSessionState(sessionID: "de300000-0000-4000-8000-000000000100")
            if let detail = demoDetail {
                state.detail = AppResourceState(
                    content: .loaded(detail),
                    freshness: AppFreshness(text: "Updated 4:05 PM", isOffline: false)
                )
            }
            state.expandedSteps = ["5e100000-0000-4000-8000-000000000001"]
            return state
        }()

        /// A planned session: nothing logged yet, every set shows its target.
        static let fixturePlanned: LiftSessionState = {
            var state = fixtureDefault
            guard var detail = demoDetail, case .ok(var hero) = detail.hero,
                case .ok(var exercises) = detail.exercises
            else { return state }
            hero.state = "planned"
            hero.stateLabel = "Planned"
            hero.ring = LiftRing(logged: 0, total: 12, progress: 0, text: "0/12", caption: "sets logged")
            exercises.items = exercises.items.map { exercise in
                var exercise = exercise
                exercise.complete = false
                exercise.sets = exercise.sets.map { set in
                    var set = set
                    set.status = "planned"
                    set.targetText = nil
                    set.rpeText = nil
                    return set
                }
                return exercise
            }
            detail.hero = .ok(hero)
            detail.exercises = .ok(exercises)
            detail.newerId = nil
            state.detail.content = .loaded(detail)
            return state
        }()

        /// The hero loaded, the exercises part failed on the server.
        static let fixtureFailedSection: LiftSessionState = {
            var state = fixtureDefault
            guard var detail = demoDetail else { return state }
            detail.exercises = .failed
            state.detail.content = .loaded(detail)
            return state
        }()

        static let fixtureLoading = LiftSessionState(sessionID: "loading")

        static let fixtureFailed: LiftSessionState = {
            var state = LiftSessionState(sessionID: "failed")
            state.detail.content = .failed(message: "Coach could not be reached. Pull down to try again.")
            return state
        }()

        private static var demoDetail: LiftSessionDetail? {
            guard let url = Bundle.main.url(forResource: "app-lift-sessions", withExtension: "json"),
                let data = try? Data(contentsOf: url)
            else { return nil }
            return try? JSONDecoder().decode(LiftSessionDetail.self, from: data)
        }
    }
#endif
