#if DEBUG
    import Foundation
    import LiftCore

    /// Named states for previews and snapshots. Made-up rows; no media is fetched (TEST-8).
    extension CatalogState {
        private static let rows = [
            CatalogRow(id: "9001", name: "Made-up barbell squat", detail: "Glutes · Barbell"),
            CatalogRow(id: "9002", name: "Made-up dumbbell curl", detail: "Biceps · Dumbbell"),
            CatalogRow(id: "9003", name: "Made-up cable row", detail: "Upper back · Cable"),
            CatalogRow(id: "9004", name: "Made-up plank", detail: "Abs · Bodyweight"),
            CatalogRow(id: "9006", name: "Made-up bench press", detail: "Pectorals · Barbell"),
            CatalogRow(id: "9007", name: "Made-up lateral raise", detail: "Delts · Dumbbell"),
            CatalogRow(id: "9008", name: "Made-up push-up", detail: "Pectorals · Bodyweight"),
            CatalogRow(id: "9009", name: "Made-up calf raise", detail: "Calves · Leverage machine"),
            CatalogRow(id: "9010", name: "Made-up face pull", detail: "Delts · Cable"),
        ]
        private static let options: [CatalogFacet: [String]] = [
            .bodyPart: ["back", "chest", "lower legs", "shoulders", "upper arms", "upper legs", "waist"],
            .target: ["abs", "biceps", "calves", "delts", "glutes", "pectorals", "upper back"],
            .equipment: ["barbell", "body weight", "cable", "dumbbell", "leverage machine"],
        ]
        private static let counts = CatalogFacetCounts(
            values: [
                .bodyPart: [
                    "back": 203, "chest": 163, "lower legs": 59, "shoulders": 143, "upper arms": 292,
                ],
                .target: ["abs": 169, "biceps": 151, "calves": 59, "delts": 143, "pectorals": 158],
                .equipment: ["barbell": 154, "body weight": 325, "cable": 157, "dumbbell": 294],
            ],
            inLibrary: 30
        )
        private static let base = CatalogState(
            options: options,
            counts: counts,
            library: ["9001", "9006"],
            rows: .loaded(rows),
            total: 1324,
            thumbnails: ["9001": MediaPreviewData.still, "9002": MediaPreviewData.still, "9003": .failed]
        )

        static let fixtureDefault = base
        static let fixtureLoading = CatalogState(rows: .loading)
        static let fixtureEmpty = CatalogState(rows: .empty)
        static let fixtureFailed = CatalogState(rows: .failed(.decoding))
        static let fixtureFiltered: CatalogState = {
            var state = base
            state.query = "press"
            state.filter = CatalogFilter(selections: [
                .bodyPart: ["chest", "shoulders"], .equipment: ["barbell"],
            ])
            state.rows = .loaded([rows[4]])
            return state
        }()
        static let fixtureFiltersSheet: CatalogState = {
            var state = fixtureFiltered
            state.sheet = .all
            return state
        }()
        static let fixtureFacetSheet: CatalogState = {
            var state = fixtureFiltered
            state.sheet = .facet(.bodyPart)
            return state
        }()
        static let fixtureNoMatches: CatalogState = {
            var state = base
            state.query = "zercher carry"
            state.rows = .loaded([])
            return state
        }()
        static let fixtureLongText: CatalogState = {
            var state = base
            state.filter = CatalogFilter(selections: [.equipment: ["cable"]], inLibrary: true)
            state.rows = .loaded([
                CatalogRow(
                    id: "9005",
                    name: "Made-up cable one arm straight back high row (kneeling, with rope attachment)",
                    detail: "Upper back · Cable"
                )
            ])
            return state
        }()
    }
#endif
