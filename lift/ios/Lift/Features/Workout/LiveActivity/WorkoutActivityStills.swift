import Foundation
import UIKit

/// The exercise photo for the workout Live Activity, small enough to travel inside its content. Live Activities cannot
/// load from the network and Lift has no App Group yet, so the still is downsampled to a tiny JPEG and sent in the
/// content state, whose whole update must stay under ActivityKit's 4 KB. `WorkoutActivityCenter` asks once per exercise.
nonisolated protocol WorkoutActivityStills: Sendable {
    /// The catalog still of `catalogID` as a small JPEG; nil when it cannot be loaded or made small enough.
    func still(catalogID: String) async -> Data?
}

/// No photos: tests, previews and anything without the catalog.
nonisolated struct NoWorkoutActivityStills: WorkoutActivityStills {
    func still(catalogID _: String) async -> Data? { nil }
}

/// The catalog's 180 × 180 still, through the app's media cache, shrunk until it fits `maxBytes`.
nonisolated struct CatalogWorkoutActivityStills: WorkoutActivityStills {
    /// Room for the photo in the content state. The JSON carries it as base64 (a third larger) beside about 600
    /// bytes of text, which keeps the update well under 4 KB.
    static let maxBytes = 1_800
    /// Pixel sides to try, largest first. The Lock Screen draws the photo at 48 pt.
    static let sides: [CGFloat] = [72, 60, 48]
    static let qualities: [CGFloat] = [0.6, 0.45]

    let catalog: any ExerciseCatalogProviding

    func still(catalogID: String) async -> Data? {
        guard let data = await catalog.image(.still, catalogID: catalogID).data else { return nil }
        return await Self.shrink(data)
    }

    /// The smallest-loss JPEG of `data` that fits `maxBytes`; nil when none does.
    @concurrent
    static func shrink(_ data: Data) async -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        for side in sides {
            guard let small = image.preparingThumbnail(of: CGSize(width: side, height: side)) else { continue }
            for quality in qualities {
                if let jpeg = small.jpegData(compressionQuality: quality), jpeg.count <= maxBytes {
                    return jpeg
                }
            }
        }
        return nil
    }
}

/// Asks for each exercise's photo once and remembers it, for `WorkoutActivityCenter`, which decides what to show
/// without waiting.
final class WorkoutActivityStillCache {
    private let stills: any WorkoutActivityStills
    /// Photos by catalog id once asked for: nil while loading or when there is none.
    private var byCatalogID: [String: Data?] = [:]

    init(stills: any WorkoutActivityStills) {
        self.stills = stills
    }

    /// The photo of the exercise that holds `setID` in `overview`, as `still(catalogID:loaded:)` gives it.
    func still(forSet setID: UUID?, in overview: WorkoutOverview, loaded: @escaping () -> Void) -> Data? {
        guard let setID,
            let catalogID = overview.exercises.first(where: { $0.sets.contains { $0.id == setID } })?.catalogID
        else { return nil }
        return still(catalogID: catalogID, loaded: loaded)
    }

    /// The photo of `catalogID` when it has loaded. The first ask starts loading it and calls `loaded` once it has.
    func still(catalogID: String, loaded: @escaping () -> Void) -> Data? {
        if let known = byCatalogID[catalogID] { return known }
        byCatalogID[catalogID] = .some(nil)
        let stills = stills
        Task {
            guard let data = await stills.still(catalogID: catalogID) else { return }
            byCatalogID[catalogID] = data
            loaded()
        }
        return nil
    }
}
