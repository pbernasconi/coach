#if DEBUG
    import Foundation
    import LiftCore

    /// Named states for previews and snapshots. Fake data only (TEST-8).
    extension TemplatesState {
        private static func slot(_ number: Int, _ name: String, _ detail: String, template: Int) -> TemplateSlotItem {
            TemplateSlotItem(id: .fixture(UInt8(template * 10 + number)), number: number, name: name, detail: detail)
        }

        static let fixtureItems = [
            TemplateItem(
                id: .fixture(1),
                name: "Upper A",
                size: TemplateText.size(exercises: 3, sets: 9),
                slots: [
                    slot(1, "Bench press", "3 × 6–8 @ 70 kg · 2 min rest", template: 1),
                    slot(2, "Barbell row", "3 × 8–10 @ 60 kg · 1:30 rest", template: 1),
                    slot(3, "Dumbbell curl", "3 × 10–12 @ 12 kg · 1 min rest", template: 1),
                ]
            ),
            TemplateItem(
                id: .fixture(2),
                name: "Lower A",
                size: TemplateText.size(exercises: 3, sets: 8),
                slots: [
                    slot(1, "Back squat", "3 × 5 @ 100 kg · 3 min rest", template: 2),
                    slot(2, "Romanian deadlift", "3 × 8 @ 80 kg · 2 min rest", template: 2),
                    slot(3, "Calf raise", "2 × 12–15", template: 2),
                ]
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
                    size: TemplateText.size(exercises: 2, sets: 6),
                    slots: [
                        slot(1, "Single-arm half-kneeling landmine press", "3 × 8–10 @ 25 kg", template: 3),
                        slot(2, "Rear-foot-elevated split squat", "3 × 8 @ 20 kg · 2 min rest", template: 3),
                    ]
                ),
                TemplateItem(
                    id: .fixture(4),
                    name: "New template",
                    size: TemplateText.size(exercises: 0, sets: 0),
                    slots: []
                ),
            ])
        )
    }
#endif
