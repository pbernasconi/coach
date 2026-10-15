import Foundation
import LiftCore
import Synchronization

@testable import Lift

/// An `ExerciseCatalogProviding` over a small made-up catalog. Images come from `images` (keyed by catalog id), or
/// `.failed`; every request is recorded. Nothing touches the bundle or the network.
nonisolated final class FakeExerciseCatalog: ExerciseCatalogProviding {
    /// The bytes every loaded image returns.
    static let imageData = Data([0x47, 0x49, 0x46])
    static let commit = String(repeating: "a", count: 40)

    private let loaded: ExerciseCatalog?
    private let images: [String: MediaImage]
    private let requests = Mutex<[ImageRequest]>([])

    struct ImageRequest: Equatable {
        var kind: CatalogMediaKind
        var catalogID: String
    }

    /// `entries` nil makes `catalog()` throw `AppError(.decoding)`.
    init(entries: [CatalogExercise]? = [], images: [String: MediaImage] = [:]) {
        loaded = entries.map { entries in
            ExerciseCatalog(
                commit: Self.commit,
                source: "https://example.com/dataset",
                license: "MIT (data)",
                attribution: "Made-up credit",
                entries: entries
            )
        }
        self.images = images
    }

    var imageRequests: [ImageRequest] { requests.withLock { $0 } }

    func catalog() async throws -> ExerciseCatalog {
        guard let loaded else { throw AppError(.decoding, detail: "fake catalog") }
        return loaded
    }

    func media(for entry: CatalogExercise) async -> ExerciseMedia? {
        guard let loaded else { return nil }
        return ExerciseMediaSource(catalog: loaded).media(for: entry)
    }

    func image(_ kind: CatalogMediaKind, for entry: CatalogExercise) async -> MediaImage {
        requests.withLock { $0.append(ImageRequest(kind: kind, catalogID: entry.id)) }
        return images[entry.id] ?? .failed
    }

    /// A made-up entry with valid media paths.
    static func entry(
        _ id: String,
        _ name: String,
        bodyPart: String = "upper legs",
        equipment: String = "barbell",
        target: String = "glutes"
    ) -> CatalogExercise {
        CatalogExercise(
            id: id,
            name: name,
            category: bodyPart,
            bodyPart: bodyPart,
            equipment: equipment,
            target: target,
            secondary: ["hamstrings"],
            muscleGroup: target,
            steps: ["Step one.", "Step two."],
            imagePath: "images/\(id)-abc.jpg",
            gifPath: "videos/\(id)-abc.gif"
        )
    }
}
