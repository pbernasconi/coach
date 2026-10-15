#if DEBUG
    import Foundation
    import LiftCore

    /// Named states for previews and snapshots. Fake data only (TEST-8).
    extension TemplatesState {
        static let fixtureItems = [
            TemplateItem(
                id: .fixture(1),
                name: "Upper A",
                exercises: "Bench press, Barbell row, Lateral raise",
                size: TemplateText.size(exercises: 3, sets: 8)
            ),
            TemplateItem(
                id: .fixture(2),
                name: "Lower A",
                exercises: "Back squat, Romanian deadlift, Calf raise",
                size: TemplateText.size(exercises: 3, sets: 8)
            ),
        ]

        static let fixtureDefault = TemplatesState(templates: .loaded(fixtureItems))
        static let fixtureLoading = TemplatesState(templates: .loading)
        static let fixtureEmpty = TemplatesState(templates: .empty)
        static let fixtureFailed = TemplatesState(templates: .failed(.unknown))
        static let fixtureOptions = TemplatesState(templates: .loaded(fixtureItems), options: fixtureItems[0])
        static let fixtureLongText = TemplatesState(
            templates: .loaded([
                TemplateItem(
                    id: .fixture(3),
                    name: "Full body with a long name for the heavy week",
                    exercises: "Single-arm half-kneeling landmine press, Rear-foot-elevated split squat, Pallof press",
                    size: TemplateText.size(exercises: 3, sets: 9)
                )
            ])
        )
    }
#endif
