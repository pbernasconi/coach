import Foundation
import LiftCore

/// The bundled exercise catalog and its media, as screens use them: entries, the media URLs and credit of an entry,
/// and its loaded still or animation. Fakes return fixed values, so ViewModel tests and previews never load the
/// bundle or the network (DI-5).
nonisolated protocol ExerciseCatalogProviding: Sendable {
    /// The whole catalog, loaded once.
    func catalog() async throws -> ExerciseCatalog
    /// The animation, still and credit of `entry`.
    func media(for entry: CatalogExercise) async -> ExerciseMedia?
    /// One of `entry`'s images, loaded; `.failed` when it cannot be.
    func image(_ kind: CatalogMediaKind, for entry: CatalogExercise) async -> MediaImage
}

extension ExerciseCatalogProviding {
    /// The entry with dataset id `id`; nil when it is unknown or the catalog cannot be loaded.
    func entry(id: String) async -> CatalogExercise? {
        try? await catalog().entry(id: id)
    }

    /// The still image of the entry `catalogID`, or `.failed` for an unknown id.
    func image(_ kind: CatalogMediaKind, catalogID: String) async -> MediaImage {
        guard let entry = await entry(id: catalogID) else { return .failed }
        return await image(kind, for: entry)
    }
}

/// The live catalog: parsed from LiftCore's bundled JSON on first use (off the main actor, about 1 MB), with media
/// from the pinned dataset commit through the injected loader.
actor LiveExerciseCatalog: ExerciseCatalogProviding {
    private let loader: any ExerciseMediaLoader
    private var loaded: ExerciseCatalog?

    init(loader: any ExerciseMediaLoader) {
        self.loader = loader
    }

    func catalog() throws -> ExerciseCatalog {
        if let loaded { return loaded }
        let catalog = try ExerciseCatalog.bundled()
        loaded = catalog
        return catalog
    }

    func media(for entry: CatalogExercise) -> ExerciseMedia? {
        guard let catalog = try? catalog() else { return nil }
        return ExerciseMediaSource(catalog: catalog).media(for: entry)
    }

    func image(_ kind: CatalogMediaKind, for entry: CatalogExercise) async -> MediaImage {
        guard let catalog = try? catalog() else { return .failed }
        let url = ExerciseMediaSource(catalog: catalog).url(path: entry.mediaPath(kind))
        return await MediaImage.load(url, with: loader)
    }
}
