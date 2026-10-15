import Foundation
import Testing

@testable import LiftCore

@Suite struct ExerciseGuideTests {
    /// `lift/ios/`, found from this file so the test reads the committed mapping and asset catalog.
    private static let iosFolder = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()  // Guide
        .deletingLastPathComponent()  // LiftCoreTests
        .deletingLastPathComponent()  // Tests
        .deletingLastPathComponent()  // LiftKit
        .deletingLastPathComponent()  // Packages
        .deletingLastPathComponent()  // ios

    @Test func everySeedExerciseHasExactlyOneGuide() {
        #expect(ExerciseGuide.all.count == ExerciseLibrary.seed.count)
        #expect(Set(ExerciseGuide.all.map(\.id)) == Set(ExerciseLibrary.seed.map(\.id)))
        for exercise in ExerciseLibrary.seed {
            #expect(ExerciseGuide.for(id: exercise.id)?.id == exercise.id, "\(exercise.name)")
        }
    }

    @Test(arguments: ExerciseLibrary.seed.map(\.name))
    func guideHasEnoughToTeachTheLift(name: String) throws {
        let exercise = try #require(ExerciseLibrary.seed.first { $0.name == name })
        let guide = try #require(ExerciseGuide.for(id: exercise.id))
        #expect(!guide.setup.isEmpty, "\(name)")
        #expect((4...7).contains(guide.steps.count), "\(name)")
        #expect((2...4).contains(guide.cues.count), "\(name)")
        #expect((2...4).contains(guide.mistakes.count), "\(name)")
        #expect(guide.breathing?.isEmpty == false, "\(name)")
        #expect(guide.videoQuery.hasSuffix("technique"), "\(name)")
        #expect(guide.curatedVideoID == nil, "\(name)")
        let lines = guide.setup + guide.steps + guide.cues + guide.mistakes
        #expect(lines.allSatisfy { !$0.trimmingCharacters(in: .whitespaces).isEmpty }, "\(name)")
    }

    @Test func anExerciseThePersonMadeHasNoGuide() {
        #expect(ExerciseGuide.for(id: UUID(uuid: (1, 2, 3, 4, 5, 6, 0x40, 8, 0x80, 10, 11, 12, 13, 14, 15, 16))) == nil)
    }

    @Test func videoURLSearchesYouTubeForTheQuery() throws {
        let guide = try #require(ExerciseGuide.for(id: ExerciseLibrary.seedID(3)))
        #expect(
            guide.videoURL?.absoluteString
                == "https://www.youtube.com/results?search_query=romanian%20deadlift%20technique"
        )
        #expect(ExerciseGuide.videoSearchURL(for: "a&b")?.absoluteString == "https://www.youtube.com/results?search_query=a%26b")
    }

    @Test func artNamesFollowTheSlug() throws {
        let squat = try #require(ExerciseGuide.for(id: ExerciseLibrary.seedID(1)))
        #expect(squat.startArtName == "back-squat-start")
        #expect(squat.endArtName == "back-squat-end")
        let plank = try #require(ExerciseGuide.for(id: ExerciseLibrary.seedID(29)))
        #expect(plank.startArtName == nil)
    }

    @Test func artSlugsMatchTheCommittedMapping() throws {
        let data = try Data(contentsOf: Self.iosFolder.appending(path: "ExerciseArt/mapping.json"))
        let mapping = try JSONDecoder().decode(ArtMapping.self, from: data)
        #expect(mapping.exercises.count == ExerciseLibrary.seed.count)
        for entry in mapping.exercises {
            let guide = ExerciseGuide.for(id: ExerciseLibrary.seedID(entry.seed))
            let seedName = ExerciseLibrary.seed.first { $0.id == guide?.id }?.name
            #expect(seedName == entry.name, "seed \(entry.seed)")
            #expect(guide?.artSlug == (entry.everkinetic == nil ? nil : entry.slug), "\(entry.name)")
        }
    }

    @Test func everyArtSlugHasStartAndEndImageSets() {
        let catalog = Self.iosFolder.appending(path: "Lift/Resources/ExerciseArt.xcassets")
        for name in ExerciseGuide.all.flatMap({ [$0.startArtName, $0.endArtName] }).compactMap(\.self) {
            let contents = catalog.appending(path: "\(name).imageset/Contents.json")
            #expect(FileManager.default.fileExists(atPath: contents.path), "\(name)")
        }
    }
}

/// The parts of `ExerciseArt/mapping.json` the tests check.
private struct ArtMapping: Decodable {
    struct Entry: Decodable {
        let seed: UInt8
        let name: String
        let slug: String
        let everkinetic: String?
    }

    let exercises: [Entry]
}
