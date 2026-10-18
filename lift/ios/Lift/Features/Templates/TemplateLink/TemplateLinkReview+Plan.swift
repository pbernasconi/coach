import Foundation
import LiftCore

extension TemplateLinkReview {
    /// The review of `plan`: every template with its exercises under their library names, and existing names set to
    /// be skipped until the person picks Replace.
    init(plan: TemplateLinkPlan) {
        self.init(
            templates: plan.items.map { item in
                TemplateLinkReviewTemplate(
                    id: item.id,
                    name: item.template.name,
                    detail: TemplateLinkText.detail(item.template),
                    exercises: zip(item.template.exercises, item.sources).enumerated().map { index, pair in
                        TemplateLinkReviewExercise(
                            id: index,
                            name: pair.1.name,
                            value: TemplateLinkText.exercise(pair.0)
                        )
                    },
                    exists: item.existingID != nil
                )
            },
            newExercises: plan.newExerciseNames.map(TemplateLinkNewExercise.init(name:))
        )
    }
}
