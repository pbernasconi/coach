import Foundation

/// One piece of remote media as a screen's state holds it. The bytes stay encoded; the view decodes them.
nonisolated enum MediaImage: Equatable, Sendable {
    case loading
    case loaded(Data)
    /// It could not be loaded (offline, missing, not an image). The view shows a symbol instead.
    case failed

    /// The loaded bytes, if any.
    var data: Data? {
        if case .loaded(let data) = self { return data }
        return nil
    }

    /// Loads `url` through `loader`; nil or any error ends as `.failed`.
    static func load(_ url: URL?, with loader: any ExerciseMediaLoader) async -> MediaImage {
        guard let url else { return .failed }
        do {
            return .loaded(try await loader.data(for: url))
        } catch {
            return .failed
        }
    }
}
