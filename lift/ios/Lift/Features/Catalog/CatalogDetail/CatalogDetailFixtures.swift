#if DEBUG
    import Foundation
    import LiftCore

    /// Named states for previews and snapshots. A made-up entry; no media is fetched (TEST-8).
    extension CatalogDetailState {
        private static let item = CatalogDetailItem(
            id: "9001",
            name: "Made-Up Barbell Squat",
            bodyPart: "Upper legs",
            target: "Glutes",
            secondary: ["Quadriceps", "Hamstrings", "Core"],
            equipment: "Barbell",
            steps: [
                "Stand with your feet shoulder-width apart, the bar across your upper back.",
                "Brace and sit down between your heels until your thighs are below parallel.",
                "Drive up through your whole foot to stand tall.",
            ]
        )

        static let fixtureDefault = CatalogDetailState(
            entry: .loaded(item),
            animation: MediaPreviewData.still,
            library: .absent
        )
        static let fixtureInLibrary = CatalogDetailState(
            entry: .loaded(item),
            animation: MediaPreviewData.still,
            library: .present(.fixture(1))
        )
        static let fixtureAdding = CatalogDetailState(entry: .loaded(item), animation: .loading, library: .adding)
        static let fixtureMediaFailed = CatalogDetailState(entry: .loaded(item), animation: .failed, library: .absent)
        static let fixtureLoading = CatalogDetailState(entry: .loading)
        static let fixtureEmpty = CatalogDetailState(entry: .empty, animation: .failed)
        static let fixtureLongText = CatalogDetailState(
            entry: .loaded(
                CatalogDetailItem(
                    id: "9002",
                    name: "Made-Up Cable One Arm Straight Back High Row (Kneeling, With Rope Attachment)",
                    bodyPart: "Back",
                    target: "Upper back",
                    secondary: ["Biceps", "Rear deltoids", "Rhomboids", "Trapezius", "Forearms"],
                    equipment: "Cable",
                    steps: item.steps + item.steps
                )
            ),
            animation: MediaPreviewData.still,
            library: .absent
        )
    }
#endif
