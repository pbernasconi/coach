#if DEBUG
    import Foundation
    import LiftCore

    /// Named states for previews and snapshots. Fake data only (TEST-8).
    extension TemplateEditorState {
        static let fixtureSlots = [
            TemplateSlotItem(id: .fixture(1), number: 1, name: "Back squat", detail: "3 × 5 @ 80 kg · 3 min rest"),
            TemplateSlotItem(
                id: .fixture(2),
                number: 2,
                name: "Romanian deadlift",
                detail: "3 × 8 @ 60 kg · 2 min rest"
            ),
            TemplateSlotItem(id: .fixture(3), number: 3, name: "Calf raise", detail: "2 × 10–15 · 1:30 rest"),
        ]

        static let fixtureOverview = TemplateOverview(
            size: TemplateText.size(exercises: 3, sets: 8),
            slots: fixtureSlots
        )

        static let fixtureDefault = TemplateEditorState(template: .loaded(fixtureOverview), name: "Lower A")
        static let fixtureLoading = TemplateEditorState(template: .loading)
        static let fixtureEmpty = TemplateEditorState(template: .empty)
        static let fixtureFailed = TemplateEditorState(template: .failed(.unknown))
        static let fixtureNew = TemplateEditorState(
            template: .loaded(TemplateOverview(size: TemplateText.size(exercises: 0, sets: 0), slots: [])),
            name: "New template"
        )
        static let fixtureEditor = TemplateEditorState(
            template: .loaded(fixtureOverview),
            name: "Lower A",
            editor: SlotEditor(
                slot: TemplateExercise(
                    id: .fixture(2),
                    exerciseID: .fixture(9),
                    displayName: "Romanian deadlift",
                    sets: 3,
                    repRange: 8...8,
                    weight: .kg(60)
                ),
                index: 1,
                count: 3,
                unit: .kg
            )
        )
        static let fixtureLongText = TemplateEditorState(
            template: .loaded(
                TemplateOverview(
                    size: TemplateText.size(exercises: 1, sets: 4),
                    slots: [
                        TemplateSlotItem(
                            id: .fixture(4),
                            number: 1,
                            name: "Single-arm half-kneeling landmine press with a pause at the top",
                            detail: "4 × 10–12 @ 22.5 kg · 1:30 rest"
                        )
                    ]
                )
            ),
            name: "Full body with a long name for the heavy week"
        )
    }
#endif
