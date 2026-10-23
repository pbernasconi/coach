import Foundation
import Testing
import UIKit

@testable import Lift

/// The exercise photo on the workout Live Activity: asked for once per exercise, remembered, and small enough to fit
/// the Live Activity's content.
@MainActor
@Suite struct WorkoutActivityStillsTests {
    @Test func theFirstAskLoadsThePhotoAndLaterAsksGetIt() async {
        let cache = WorkoutActivityStillCache(stills: FixedStills(data: Data([1, 2, 3])))

        await withCheckedContinuation { continuation in
            #expect(cache.still(catalogID: "0043") { continuation.resume() } == nil)
        }

        #expect(cache.still(catalogID: "0043") {} == Data([1, 2, 3]))
    }

    @Test func anExerciseWithoutAPhotoStaysWithout() async {
        let cache = WorkoutActivityStillCache(stills: FixedStills(data: nil))

        #expect(cache.still(catalogID: "0043") {} == nil)
        #expect(cache.still(catalogID: "0043") {} == nil)
    }

    @Test func aCatalogStillShrinksUnderTheLimit() async throws {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 180, height: 180))
        let drawn = renderer.image { context in
            UIColor.white.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 180, height: 180))
            UIColor.red.setFill()
            context.fill(CGRect(x: 40, y: 30, width: 100, height: 120))
        }
        let original = try #require(drawn.jpegData(compressionQuality: 0.9))

        let small = try #require(await CatalogWorkoutActivityStills.shrink(original))

        #expect(small.count <= CatalogWorkoutActivityStills.maxBytes)
        #expect(UIImage(data: small) != nil)
    }
}

private struct FixedStills: WorkoutActivityStills {
    let data: Data?

    func still(catalogID _: String) async -> Data? { data }
}
