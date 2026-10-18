#if DEBUG
    import Foundation
    import KoboPatterns
    import LiftCore

    /// Named states for previews and snapshots. Fake data only: the made-up `TemplateLinkSample` (TEST-8).
    extension TemplateLinkState {
        /// The sample against the seed library, with a demo "Lower A" already in the list and no catalog.
        private static let sampleReview: TemplateLinkReview = {
            let existing = DayTemplate(
                id: .fixture(1),
                name: "Lower A",
                exercises: [],
                position: 0,
                createdAt: Date(timeIntervalSince1970: 0),
                updatedAt: Date(timeIntervalSince1970: 0)
            )
            let templates = (try? TemplateLink.decode(TemplateLinkSample.encoded)) ?? []
            let plan = TemplateLinkPlan.make(
                templates,
                library: ExerciseLibrary.seed,
                catalog: [],
                existing: [existing]
            )
            return TemplateLinkReview(plan: plan)
        }()

        private static var replacing: TemplateLinkReview {
            var review = sampleReview
            review.templates = review.templates.map { template in
                var template = template
                template.replaces = template.exists
                return template
            }
            return review
        }

        static let fixtureLoading = TemplateLinkState()
        static let fixtureReview = TemplateLinkState(phase: .review(sampleReview))
        static let fixtureReplacing = TemplateLinkState(phase: .review(replacing))
        static let fixtureAdding = TemplateLinkState(
            phase: .review(sampleReview),
            submit: LoadableStepState(.loading)
        )
        static let fixtureAddFailed: TemplateLinkState = {
            var submit = LoadableStepState()
            submit.send(.submit)
            submit.send(.fail(message: String(localized: "The templates could not be added. Try again.")))
            return TemplateLinkState(phase: .review(sampleReview), submit: submit)
        }()
        static let fixtureUnreadable = TemplateLinkState(phase: .failed(.unreadable))
        static let fixtureNewerVersion = TemplateLinkState(phase: .failed(.newerVersion))
        static let fixtureLongText: TemplateLinkState = {
            var review = sampleReview
            review.templates = review.templates.map { template in
                var template = template
                template.name = "Lower body strength with extra accessory work"
                template.exercises = template.exercises.map { exercise in
                    var exercise = exercise
                    exercise.name += " with a long made-up variation name"
                    return exercise
                }
                return template
            }
            return TemplateLinkState(phase: .review(review))
        }()
    }
#endif
