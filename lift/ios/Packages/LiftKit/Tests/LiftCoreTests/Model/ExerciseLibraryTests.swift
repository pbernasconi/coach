import Foundation
import Testing

@testable import LiftCore

@Suite struct ExerciseLibraryTests {
    @Test func hasThirtyLiftsWithUniqueStableIDs() {
        let seed = ExerciseLibrary.seed
        #expect(seed.count == 30)
        #expect(Set(seed.map(\.id)).count == seed.count)
        #expect(seed.first?.id.uuidString == "4C494654-0000-4000-8000-000000000001")
        #expect(ExerciseLibrary.seed == seed)
    }

    @Test func everyNameAndAliasIsUniqueAfterNormalizing() {
        let keys = ExerciseLibrary.seed.flatMap { [$0.name] + $0.aliases }.map(ExerciseMatcher.normalizedName)
        #expect(Set(keys).count == keys.count)
    }

    @Test func everyLiftHasAPrimaryMuscleAndSeedStamps() {
        for exercise in ExerciseLibrary.seed {
            #expect(!exercise.primary.isEmpty, "\(exercise.name)")
            #expect(exercise.createdAt == ExerciseLibrary.seedDate)
            #expect(exercise.deletedAt == nil)
            #expect(!exercise.isArchived)
        }
    }

    @Test func dumbbellPairsArePerHandAndBodyweightLiftsHaveNoLoad() {
        let byName = Dictionary(uniqueKeysWithValues: ExerciseLibrary.seed.map { ($0.name, $0) })
        #expect(byName["Dumbbell bench press"]?.loadMode == .perHand)
        #expect(byName["Pull-up"]?.loadMode == .bodyweight(added: nil))
        #expect(byName["Back squat"]?.loadMode == .total)
    }
}
