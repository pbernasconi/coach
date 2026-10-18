import Foundation
import Testing

@testable import LiftCore

/// Resolving linked exercise names: the library first, then the bundled catalog, else a new exercise.
@Suite struct TemplateLinkResolverTests {
    static let library = ExerciseLibrary.seed
    static let catalog: [CatalogExercise] = (try? ExerciseCatalog.bundled().entries) ?? []

    private func resolve(_ name: String, load: LinkedLoad? = nil, library: [Exercise] = Self.library)
        -> LinkedExerciseSource
    {
        TemplateLinkResolver.resolve(LinkedExercise(name: name, load: load), library: library, catalog: Self.catalog)
    }

    @Test(
        arguments: [
            ("Romanian deadlift", 3),
            ("romanian  DEADLIFTS", 3),
            ("Bulgarian split squat", 17),
            ("Kettlebell swing", 21),
            ("kb swing", 21),
            ("Back squat", 1),
            ("row single arm db", 11),
        ] as [(String, UInt8)]
    )
    func libraryNamesMatchTheLibrary(name: String, seed: UInt8) throws {
        let exercise = try #require(ExerciseLibrary.seed.first { $0.id == ExerciseLibrary.seedID(seed) })
        #expect(resolve(name) == .library(exercise))
    }

    @Test func aCatalogNameComesFromTheCatalog() throws {
        #expect(!Self.catalog.isEmpty)
        guard case .catalog(let entry) = resolve("Weighted pull-up") else {
            Issue.record("expected a catalog entry")
            return
        }
        #expect(entry.name == "Weighted Pull-Up")
        #expect(entry.libraryLoadMode.isBodyweight)
    }

    @Test func aCatalogEntryAlreadyInTheLibraryIsReused() throws {
        let entry = try #require(Self.catalog.first { $0.name == "Weighted Pull-Up" })
        var made = Exercise(
            id: UUID(uuid: (0xBB, 0, 0, 0, 0, 0, 0x40, 0, 0x80, 0, 0, 0, 0, 0, 0, 1)),
            name: "Pull-up with a belt",
            equipment: .bodyweight,
            loadMode: .bodyweight(added: nil),
            primary: [.back],
            catalogID: entry.id,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
        made.isArchived = true
        #expect(resolve("Weighted pull-up", library: Self.library + [made]) == .library(made))
    }

    @Test func anUnknownNameIsANewExerciseWithItsEquipmentFromTheName() {
        #expect(
            resolve("Dumbbell bench pull")
                == .new(name: "Dumbbell bench pull", equipment: .dumbbell, loadMode: .perHand)
        )
        #expect(resolve("Sample sled thing") == .new(name: "Sample sled thing", equipment: .other, loadMode: .total))
        #expect(resolve("Cable sample fly").name == "Cable sample fly")
    }

    @Test func theLinkLoadDecidesANewExercisesLoadMode() {
        #expect(
            resolve("Dumbbell bench pull", load: .total)
                == .new(name: "Dumbbell bench pull", equipment: .dumbbell, loadMode: .total)
        )
        #expect(
            resolve("Sample hang", load: .bodyweight)
                == .new(name: "Sample hang", equipment: .bodyweight, loadMode: .bodyweight(added: nil))
        )
        #expect(resolve("Sample split", load: .side).isNewToLibrary)
    }

    @Test func aTieInTheCatalogIsNoMatch() {
        let one = CatalogExercise.sample("9001", "Sample Press")
        let two = CatalogExercise.sample("9002", "sample-press")
        let source = TemplateLinkResolver.resolve(
            LinkedExercise(name: "Sample press"),
            library: [],
            catalog: [one, two]
        )
        #expect(source == .new(name: "Sample press", equipment: .other, loadMode: .total))
        let reordered = TemplateLinkResolver.resolve(LinkedExercise(name: "press sample"), library: [], catalog: [one])
        #expect(reordered == .catalog(one))
    }

    @Test func thePlanFindsExistingTemplatesAndListsNewExercisesOnce() throws {
        let templates = try TemplateLink.decode(TemplateLinkFixtures.encoded)
        let existing = DayTemplate(
            id: UUID(uuid: (0xCC, 0, 0, 0, 0, 0, 0x40, 0, 0x80, 0, 0, 0, 0, 0, 0, 1)),
            name: "test DAY a",
            exercises: [],
            position: 0,
            createdAt: Date(timeIntervalSince1970: 0),
            updatedAt: Date(timeIntervalSince1970: 0)
        )
        let plan = TemplateLinkPlan.make(
            templates + [templates[1]],
            library: Self.library,
            catalog: Self.catalog,
            existing: [existing]
        )
        #expect(plan.items.map(\.existingID) == [existing.id, nil, nil])
        #expect(plan.items[0].sources.allSatisfy { !$0.isNewToLibrary })
        #expect(plan.newExerciseNames == ["Sample carry"])
    }
}

extension CatalogExercise {
    /// A made-up catalog entry.
    static func sample(_ id: String, _ name: String) -> CatalogExercise {
        CatalogExercise(
            id: id,
            name: name,
            category: "chest",
            bodyPart: "chest",
            equipment: "assisted",
            target: "pectorals",
            secondary: [],
            muscleGroup: "pectorals",
            steps: [],
            imagePath: "images/\(id).jpg",
            gifPath: "videos/\(id).gif"
        )
    }
}
