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

    /// Everything the app ships that someone else made. The exercise media integration adds its entries here
    /// (the dataset's MIT notice and the "© Gym visual — https://gymvisual.com/" credit).
    static let bundled: [Acknowledgement] = [
        Acknowledgement(
            id: "grdb",
            title: "GRDB.swift",
            detail: String(localized: "SQLite toolkit by Gwendal Roué. Stores your workouts on this iPhone."),
            license: "MIT",
            licenseURL: URL(string: "https://github.com/groue/GRDB.swift/blob/master/LICENSE"),
            sourceURL: URL(string: "https://github.com/groue/GRDB.swift")
        )
    ]
}
