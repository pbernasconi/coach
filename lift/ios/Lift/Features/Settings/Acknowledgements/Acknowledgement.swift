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

    /// What the app ships that someone else made: GRDB and the exercise catalog's text (MIT).
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
    ]
}
