import Foundation
import Testing

@testable import LiftCore

@Suite struct GymSetupTests {
    @Test func standardMatchesTheOldDefaults() {
        #expect(PlateSet.standard(.kg).bar == 20)
        #expect(PlateSet.standard(.kg).plates == [25, 20, 15, 10, 5, 2.5, 1.25])
        #expect(PlateSet.standard(.lb).bar == 45)
        #expect(PlateSet.standard(.lb).plates == [45, 35, 25, 10, 5, 2.5])
        #expect(GymSetup.standard.barbellStep(in: .kg) == 2.5)
        #expect(GymSetup.standard.barbellStep(in: .lb) == 5)
    }

    @Test func plateSetHasOnlyThePlatesThatAreOnWithTheirPairs() {
        var gym = GymSetup.standard
        gym.kg.plates = [
            GymPlate(size: 20, isAvailable: true, pairs: 3),
            GymPlate(size: 10, isAvailable: false, pairs: 2),
            GymPlate(size: 0.5, isAvailable: true, pairs: 1),
        ]
        gym.kg.bar = 15
        gym.kg.collar = 2.5
        let set = gym.plateSet(.kg)
        #expect(set.bar == 20)
        #expect(set.stock == [PlateSet.Stock(size: 20, pairs: 3), PlateSet.Stock(size: 0.5, pairs: 1)])
        #expect(gym.barbellStep(in: .kg) == 1)
        #expect(gym.plateSet(.lb) == .standard(.lb))
    }

    private static let incrementCases: [([Double], Double)] = [
        ([25, 20, 2.5, 1.25], 2.5),  // the default increment loads
        ([25, 20, 5], 10),  // no plate under 5 kg: 10 kg steps
        ([25, 20, 2.5], 5),
        ([20, 0.5], 3),  // 1 kg steps: the next whole step above 2.5
        ([], 2.5),  // no plates: the default
    ]

    @Test(arguments: incrementCases)
    func barbellIncrementIsAWholeNumberOfSteps(plates: [Double], expected: Double) {
        var gym = GymSetup.standard
        gym.kg.plates = plates.map { GymPlate(size: $0, isAvailable: true, pairs: 2) }
        #expect(gym.increment(for: .barbell, in: .kg) == .kg(expected))
    }

    @Test func otherEquipmentKeepsItsDefaultIncrement() {
        var gym = GymSetup.standard
        gym.lb.plates = [GymPlate(size: 10, isAvailable: true, pairs: 2)]
        #expect(gym.increment(for: .barbell, in: .lb) == .lb(20))
        #expect(gym.increment(for: .dumbbell, in: .lb) == .lb(5))
        #expect(gym.increment(for: nil, in: .lb) == .lb(5))
    }

    @Test func roundTripsThroughJSON() throws {
        var gym = GymSetup.standard
        gym.lb.collar = 5.5
        gym.lb.plates[0].isAvailable = true
        let data = try JSONEncoder().encode(gym)
        #expect(try JSONDecoder().decode(GymSetup.self, from: data) == gym)
    }

    @Test func subscriptWritesTheRightUnit() {
        var gym = GymSetup.standard
        gym[.lb].bar = 35
        #expect(gym.lb.bar == 35)
        #expect(gym.kg == .standard(.kg))
    }

    @Test(arguments: WeightUnit.allCases)
    func defaultBarAndCollarAreAmongTheChoices(unit: WeightUnit) {
        let setup = BarbellSetup.standard(unit)
        #expect(BarbellSetup.bars(unit).contains(setup.bar))
        #expect(BarbellSetup.collars(unit).contains(setup.collar))
        #expect(setup.plates.map(\.size) == setup.plates.map(\.size).sorted(by: >))
    }
}
