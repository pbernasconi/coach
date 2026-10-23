import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// The set editor's plate drawing: which plates a weight needs, what changes from the set before, and its labels.
/// Made-up gyms only (TEST-8).
@Suite struct EditorPlatesTests {
    static let bar = EditorPlates(
        holder: .bar(45),
        plateSet: GymSetup.standard.lb.plateSet,
        onBar: 225,
        onBarPlates: [45, 45]
    )

    @Test func addsPlatesOntoWhatIsLoaded() throws {
        let loading = Self.bar.loading(for: 255)

        #expect(loading.perSide == [45, 45, 10, 5])
        #expect(loading.change?.add == [10, 5])
        #expect(loading.change?.remove == [])
        #expect(loading.isExact)
        #expect(WorkoutText.plateChange(try #require(loading.change)) == "Add 10 + 5 a side")
        #expect(WorkoutText.platesPerSide(loading) == "45 · 45 · 10 · 5 a side")
    }

    @Test func takesPlatesOffGoingDown() throws {
        var plates = Self.bar
        plates.onBar = 255
        plates.onBarPlates = [45, 45, 10, 5]

        let loading = plates.loading(for: 225)

        #expect(loading.change?.remove == [10, 5])
        #expect(WorkoutText.plateChange(try #require(loading.change)) == "Take off 10 + 5 a side")
    }

    @Test func noChangeLineBeforeTheFirstSetOrWhenNothingChanges() {
        var plates = Self.bar
        plates.onBar = nil
        #expect(plates.loading(for: 225).change == nil)

        plates.onBar = 225
        let same = plates.loading(for: 225)
        #expect(same.change.flatMap(WorkoutText.plateChange) == nil)
    }

    @Test func eachLoggedSetLoadsOnTheOneBefore() throws {
        var exercise = SessionExerciseRecord(
            id: UUID(),
            sessionID: UUID(),
            slot: ExerciseSlot(exercise: Fixtures.squat),
            position: 0,
            createdAt: ManualNow.start,
            updatedAt: ManualNow.start
        )
        exercise.equipment = .barbell
        exercise.loadMode = .total

        let plates = try #require(
            EditorPlates.make(for: exercise, unit: .lb, gym: .standard, logged: [.lb(225), .lb(255)])
        )

        #expect(plates.onBar == 255)
        #expect(plates.onBarPlates == [45, 45, 10, 5])
    }

    @Test func emptyBarAndWeightsThePlatesCannotMake() {
        #expect(WorkoutText.platesPerSide(Self.bar.loading(for: 45)) == "Empty bar")

        let odd = Self.bar.loading(for: 252)
        #expect(!odd.isExact)
        #expect(odd.loaded == 250)
    }

    @Test func aPlateLoadedMachineCountsOneSide() {
        let sleeve = EditorPlates(
            holder: .sleeve,
            plateSet: PlateSet(unit: .lb, bar: 0, stock: GymSetup.standard.lb.plateSet.stock),
            onBar: 135,
            onBarPlates: [45, 45, 45]
        )

        let loading = sleeve.loading(for: 180)

        #expect(loading.perSide == [45, 45, 45, 45])
        #expect(loading.loaded == 180)
        #expect(loading.change?.add == [45])
    }
}
