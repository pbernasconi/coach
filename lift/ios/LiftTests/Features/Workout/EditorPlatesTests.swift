import Foundation
import LiftCore
import LiftStore
import LiftTesting
import Testing

@testable import Lift

/// The set editor's plate drawing: which plates a weight needs, heaviest first, and the line under it.
/// Made-up gyms only (TEST-8).
@Suite struct EditorPlatesTests {
    static let bar = EditorPlates(holder: .bar(45), plateSet: GymSetup.standard.lb.plateSet)

    @Test func loadsHeaviestFirst() {
        let loading = Self.bar.loading(for: 255)

        #expect(loading.perSide == [45, 45, 10, 5])
        #expect(loading.isExact)
        #expect(WorkoutText.platesSummary(loading) == "45 bar + 105 a side")
        #expect(WorkoutText.platesAccessibility(loading) == "Plates a side: 45, 45, 10, 5")
    }

    @Test func labelsEveryPlate() {
        #expect([45, 2.5].map(WorkoutText.plateLabel) == ["45", "2.5"])
    }

    @Test func makesPlatesOnlyForPlateLoadedLifts() {
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
        #expect(EditorPlates.make(for: exercise, unit: .lb, gym: .standard)?.holder == .bar(45))

        exercise.equipment = .dumbbell
        exercise.loadMode = .perHand
        #expect(EditorPlates.make(for: exercise, unit: .lb, gym: .standard) == nil)
    }

    @Test func emptyBarAndWeightsThePlatesCannotMake() {
        #expect(WorkoutText.platesSummary(Self.bar.loading(for: 45)) == "Empty bar")

        let odd = Self.bar.loading(for: 252)
        #expect(!odd.isExact)
        #expect(odd.loaded == 250)
    }

    @Test func aPlateLoadedMachineCountsOneSide() {
        let sleeve = EditorPlates(
            holder: .sleeve,
            plateSet: PlateSet(unit: .lb, bar: 0, stock: GymSetup.standard.lb.plateSet.stock)
        )

        let loading = sleeve.loading(for: 180)

        #expect(loading.perSide == [45, 45, 45, 45])
        #expect(loading.loaded == 180)
        #expect(WorkoutText.platesSummary(loading) == "180 a side")
    }
}
