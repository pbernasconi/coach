import Foundation
import Testing

@testable import LiftCore

/// The bundled catalog: it loads, links every seed exercise and holds clean text.
@Suite struct ExerciseCatalogTests {
    private static let catalog = Result { try ExerciseCatalog.bundled() }

    private func bundled() throws -> ExerciseCatalog {
        try Self.catalog.get()
    }

    @Test func bundledCatalogLoadsEveryEntry() throws {
        let catalog = try bundled()
        #expect(catalog.entries.count == 1324)
        #expect(Set(catalog.entries.map(\.id)).count == 1324)
        #expect(catalog.commit == "7455efae41b330c265e7cd4b78dfa848e7ce5ebd")
        #expect(catalog.attribution == "© Gym visual — https://gymvisual.com/")
        #expect(catalog.license.contains("not included"))
        #expect(catalog.entries.allSatisfy { !$0.steps.isEmpty && !$0.name.isEmpty })
    }

    @Test func mediaPathsPointIntoTheDatasetFolders() throws {
        for entry in try bundled().entries {
            #expect(entry.mediaPath(.still) == entry.imagePath)
            #expect(entry.imagePath.hasPrefix("images/\(entry.id)-") && entry.imagePath.hasSuffix(".jpg"))
            #expect(entry.mediaPath(.animation).hasPrefix("videos/\(entry.id)-"))
            #expect(entry.gifPath.hasSuffix(".gif"))
        }
    }

    @Test func everySeedExerciseLinksToAnExistingEntry() throws {
        let catalog = try bundled()
        for exercise in ExerciseLibrary.seed {
            let id = try #require(exercise.catalogID, "\(exercise.name)")
            #expect(CatalogSeedLinks.catalogID(forSeedExerciseID: exercise.id) == id)
            #expect(catalog.entry(id: id) != nil, "\(exercise.name) → \(id)")
            #expect(catalog.entry(forSeedExerciseID: exercise.id)?.id == id)
        }
        #expect(CatalogSeedLinks.all.count == ExerciseLibrary.seed.count)
        #expect(CatalogSeedLinks.seedLink(seedNumber: 20)?.approximate != nil)
    }

    @Test func swiftSeedTableMatchesTheImportedSeedMap() throws {
        let imported = try bundled().seeds
        let table = Dictionary(uniqueKeysWithValues: CatalogSeedLinks.all.map { (String($0.seed), $0.catalogID) })
        #expect(imported == table)
    }

    @Test func nonSeedIDsHaveNoLink() {
        #expect(CatalogSeedLinks.catalogID(forSeedExerciseID: UUID(uuid: (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1))) == nil)
        #expect(CatalogSeedLinks.seedLink(seedNumber: 99) == nil)
    }

    @Test func mojibakeIsFixedAndNamesAreTitleCased() throws {
        let catalog = try bundled()
        let text = catalog.entries.flatMap { [$0.name] + $0.steps + $0.secondary }
        #expect(!text.contains { $0.contains("в°") || $0.contains("â€") || $0.contains("Â") })
        #expect(catalog.entry(id: "0739")?.name == "Sled 45° Leg Press")
        #expect(catalog.entry(id: "0001")?.name == "3/4 Sit-Up")
        #expect(catalog.entry(id: "0043")?.name == "Barbell Full Squat")
    }

    @Test(arguments: [
        ("squat", "Squat"),  // the name starts with the query
        ("full squat", "Full Squat"),  // a word of the name starts with it
        ("ull squa", "Full Squat"),  // contained
    ])
    func searchFindsByName(query: String, expectedFirstContaining: String) throws {
        let results = try bundled().search(query)
        let first = try #require(results.first)
        #expect(first.name.contains(expectedFirstContaining), "\(query) → \(first.name)")
    }

    @Test func searchRanksPrefixThenWordPrefixThenContains() {
        let catalog = ExerciseCatalog.sample([
            "Reverse Lunge Twist",  // contains "unge" only
            "Barbell Lunge",  // word prefix
            "Lunge",  // name prefix, shortest
            "Lunge With Twist",  // name prefix
        ])
        #expect(catalog.search("lunge").map(\.name) == ["Lunge", "Lunge With Twist", "Barbell Lunge", "Reverse Lunge Twist"])
        #expect(catalog.search("unge").map(\.name) == ["Lunge", "Barbell Lunge", "Lunge With Twist", "Reverse Lunge Twist"])
    }

    @Test func searchMatchesTargetAndEquipmentTokensAndIgnoresCase() throws {
        let catalog = try bundled()
        let results = catalog.search("LATS cable")
        #expect(!results.isEmpty)
        #expect(results.allSatisfy { $0.equipment == "cable" || $0.name.lowercased().contains("cable") })
        #expect(catalog.search("zzzz-no-such").isEmpty)
    }

    @Test func filtersByBodyPartAndEquipment() throws {
        let catalog = try bundled()
        let filter = CatalogFilter(bodyPart: "upper legs", equipment: "barbell")
        let results = catalog.search("", filter: filter)
        #expect(!results.isEmpty)
        #expect(results.allSatisfy { $0.bodyPart == "upper legs" && $0.equipment == "barbell" })
        #expect((results.first?.name.count ?? 0) <= (results.last?.name.count ?? 0))
        #expect(catalog.search("").count == 1324)
        #expect(catalog.bodyParts.contains("chest"))
        #expect(catalog.equipment.contains("body weight"))
    }

    @Test func badJSONThrowsDecoding() {
        #expect(throws: AppError(.decoding, detail: "exercise catalog")) {
            try ExerciseCatalog(json: Data("{}".utf8))
        }
    }

    @Test func entriesMapToLibraryFields() throws {
        let catalog = try bundled()
        let squat = try #require(catalog.entry(id: "0043"))
        #expect(squat.libraryEquipment == .barbell)
        #expect(squat.libraryLoadMode == .total)
        #expect(squat.primaryMuscles == [.glutes])
        #expect(squat.secondaryMuscles == [.quads, .hamstrings, .calves, .core])
        let curl = try #require(catalog.entry(id: "0294"))
        #expect(curl.libraryEquipment == .dumbbell)
        #expect(curl.libraryLoadMode == .perHand)
        let row = try #require(catalog.entry(id: "0292"))
        #expect(row.libraryLoadMode == .total)
        let plank = try #require(catalog.entry(id: "2135"))
        #expect(plank.libraryLoadMode == .bodyweight(added: nil))
        #expect(squat.secondaryMuscles.allSatisfy { !squat.primaryMuscles.contains($0) })
    }
}

extension ExerciseCatalog {
    /// A small catalog of made-up entries with the given names.
    static func sample(_ names: [String]) -> ExerciseCatalog {
        let entries = names.enumerated().map { index, name in
            CatalogExercise(
                id: String(format: "%04d", index + 1),
                name: name,
                category: "upper legs",
                bodyPart: "upper legs",
                equipment: "body weight",
                target: "quads",
                secondary: [],
                muscleGroup: "glutes",
                steps: ["Step."],
                imagePath: "images/x.jpg",
                gifPath: "videos/x.gif"
            )
        }
        return ExerciseCatalog(commit: "c", source: "s", license: "l", attribution: "a", entries: entries)
    }
}
