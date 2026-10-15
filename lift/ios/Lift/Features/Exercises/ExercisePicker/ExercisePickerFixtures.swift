#if DEBUG
    import Foundation
    import LiftCore

    /// Named states for previews and snapshots. Fake data only (TEST-8).
    extension ExercisePickerState {
        private static let library = ExerciseLibrary.seed.map { ExerciseItem(exercise: $0) }
        private static let catalogRows = [
            CatalogRow(id: "0043", name: "Barbell full squat", detail: "Glutes · Barbell"),
            CatalogRow(id: "0042", name: "Barbell front squat", detail: "Glutes · Barbell"),
            CatalogRow(id: "0085", name: "Barbell romanian deadlift", detail: "Glutes · Barbell"),
        ]

        static let fixtureDefault = ExercisePickerState(
            library: .loaded(library),
            catalog: .loaded(catalogRows),
            thumbnails: ["0043": MediaPreviewData.still, "0042": MediaPreviewData.still, "0085": .failed]
        )
        static let fixtureLoading = ExercisePickerState()
        static let fixtureEmpty = ExercisePickerState(library: .empty, catalog: .loaded(catalogRows))
        static let fixtureFailed = ExercisePickerState(source: .catalog, library: .empty, catalog: .failed(.unknown))
        static let fixtureCatalog = ExercisePickerState(
            query: "squat",
            source: .catalog,
            library: .loaded(library),
            catalog: .loaded(catalogRows),
            thumbnails: ["0043": MediaPreviewData.still],
            adding: .catalog("0042")
        )
        static let fixtureNoMatches = ExercisePickerState(query: "zercher", library: .loaded(library))
        static let fixtureLongText = ExercisePickerState(
            library: .loaded([
                ExerciseItem(
                    id: .fixture(1),
                    name: "Single-arm half-kneeling landmine press with a pause at the top",
                    aliases: [],
                    detail: "Barbell · Shoulders, Triceps, Chest"
                )
            ])
        )
    }
#endif
