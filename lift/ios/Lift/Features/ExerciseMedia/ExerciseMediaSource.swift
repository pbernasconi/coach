import Foundation
import LiftCore

/// Where the catalog's media lives: the dataset repository on raw.githubusercontent.com at the commit the catalog was
/// built from. Media is © Gym visual: it is loaded at runtime at its published 180 × 180 size and never bundled or
/// re-hosted, and every view that shows it carries `attribution` (see `MediaAttribution`).
nonisolated struct ExerciseMediaSource: Equatable, Sendable {
    /// The page the credit links to.
    static let creditURL = URL(string: "https://gymvisual.com/")
    private static let repository = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/"

    /// The pinned dataset commit (40 hex digits).
    let commit: String
    /// "© Gym visual — https://gymvisual.com/".
    let attribution: String

    init(commit: String, attribution: String) {
        self.commit = commit
        self.attribution = attribution
    }

    init(catalog: ExerciseCatalog) {
        self.init(commit: catalog.commit, attribution: catalog.attribution)
    }

    /// The raw URL of a dataset path ("videos/0043-xxxx.gif"); nil for a malformed commit or path, so a bad catalog
    /// value can never point the app at another repository or folder.
    func url(path: String) -> URL? {
        guard Self.isCommit(commit), Self.isMediaPath(path) else { return nil }
        return URL(string: Self.repository + commit + "/" + path)
    }

    /// The animation, still and credit of a catalog entry.
    func media(for entry: CatalogExercise) -> ExerciseMedia? {
        guard let gif = url(path: entry.gifPath), let still = url(path: entry.imagePath) else { return nil }
        return ExerciseMedia(gifURL: gif, thumbnailURL: still, attribution: attribution)
    }

    private static func isCommit(_ text: String) -> Bool {
        text.count == 40 && text.allSatisfy(\.isHexDigit)
    }

    /// "images/<name>.jpg" or "videos/<name>.gif" with a plain file name.
    private static func isMediaPath(_ path: String) -> Bool {
        let parts = path.split(separator: "/", omittingEmptySubsequences: false)
        guard parts.count == 2, parts[0] == "images" || parts[0] == "videos" else { return false }
        let name = parts[1]
        let allowed = name.allSatisfy {
            $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" || $0 == ".")
        }
        return allowed && !name.hasPrefix(".") && (name.hasSuffix(".jpg") || name.hasSuffix(".gif"))
    }
}
