#if DEBUG
    import Foundation
    import LiftCore

    /// Named states for previews and snapshots. Made-up rows; no media is fetched (TEST-8).
    extension CatalogState {
        private static let rows = [
            CatalogRow(id: "9001", name: "Made-Up Barbell Squat", detail: "Glutes · Barbell"),
            CatalogRow(id: "9002", name: "Made-Up Dumbbell Curl", detail: "Biceps · Dumbbell"),
            CatalogRow(id: "9003", name: "Made-Up Cable Row", detail: "Upper back · Cable"),
            CatalogRow(id: "9004", name: "Made-Up Plank", detail: "Abs · Body weight"),
        ]
        private static let base = CatalogState(
            bodyParts: ["back", "chest", "upper arms", "upper legs", "waist"],
            equipmentKinds: ["barbell", "body weight", "cable", "dumbbell"],
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
            state.query = "squat"
            state.bodyPart = .only("upper legs")
            state.equipment = .only("barbell")
            state.rows = .loaded([rows[0]])
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
            state.rows = .loaded([
                CatalogRow(
                    id: "9005",
                    name: "Made-Up Cable One Arm Straight Back High Row (Kneeling, With Rope Attachment)",
                    detail: "Upper back · Cable"
                )
            ])
            return state
        }()
    }
#endif
