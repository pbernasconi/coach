import Foundation

/// Third-party work bundled with Lift, with its licence. Shown on the Acknowledgements screen.
nonisolated struct Acknowledgement: Equatable, Sendable, Identifiable {
    var id: String
    /// "GRDB.swift".
    var title: String
    /// What it is and how Lift uses it.
    var detail: String
    /// "MIT".
    var license: String
    var licenseURL: URL?
    var sourceURL: URL?

    /// Everything the app ships or shows that someone else made: GRDB, the exercise catalog's text (MIT) and its
    /// media (© Gym visual, loaded at runtime and never bundled; see `ExerciseMedia/ATTRIBUTION.md`).
    static let bundled: [Acknowledgement] = [
        Acknowledgement(
            id: "grdb",
            title: "GRDB.swift",
            detail: String(localized: "SQLite toolkit by Gwendal Roué. Stores your workouts on this iPhone."),
            license: "MIT",
            licenseURL: URL(string: "https://github.com/groue/GRDB.swift/blob/master/LICENSE"),
            sourceURL: URL(string: "https://github.com/groue/GRDB.swift")
        ),
        Acknowledgement(
            id: "exercises-dataset",
            title: "Exercises dataset",
            detail: String(
                localized: """
                    Exercise names, muscles, equipment and steps in "All exercises", by Hasan Emir Yıldırım. \
                    Copyright (c) 2026 Hasan Emir Yıldırım.
                    """
            ),
            license: "MIT",
            licenseURL: URL(
                string:
                    "https://github.com/hasaneyldrm/exercises-dataset/blob/7455efae41b330c265e7cd4b78dfa848e7ce5ebd/LICENSE"
            ),
            sourceURL: URL(string: "https://github.com/hasaneyldrm/exercises-dataset")
        ),
        Acknowledgement(
            id: "gym-visual",
            title: "© Gym visual — https://gymvisual.com/",
            detail: String(
                localized: """
                    The exercise animations and stills. Loaded from the exercises dataset when shown, never stored \
                    in the app; not covered by the MIT licence.
                    """
            ),
            license: String(localized: "© Gym visual, used with permission"),
            licenseURL: URL(string: "https://gymvisual.com/content/3-terms-and-conditions-of-use"),
            sourceURL: URL(string: "https://gymvisual.com/")
        ),
    ]
}
