#if DEBUG
    import Foundation
    import LiftCore

    /// Named states for previews and snapshots. Made-up gyms only (TEST-8).
    extension PlatesState {
        /// A home gym: a 15 kg bar, no 25s, two pairs of 20s, fractional plates and competition collars.
        static let fixtureHomeGym: GymSetup = {
            var gym = GymSetup.standard
            gym.kg.bar = 15
            gym.kg.collar = 2.5
            for index in gym.kg.plates.indices {
                let plate = gym.kg.plates[index]
                gym.kg.plates[index].isAvailable = plate.size != 25 && plate.size != 1
                gym.kg.plates[index].pairs = plate.size == 0.5 ? 1 : 2
            }
            return gym
        }()

        static let fixtureDefault = PlatesState(unit: .kg, setup: .standard)
        static let fixturePounds = PlatesState(unit: .lb, setup: .standard)
        static let fixtureLoading = PlatesState(unit: .kg)
        static let fixtureHome = PlatesState(unit: .kg, setup: fixtureHomeGym)
        static let fixturePlateSheet = PlatesState(
            unit: .kg,
            setup: fixtureHomeGym,
            plateEditor: PlateEditor(unit: .kg, plate: GymPlate(size: 20, isAvailable: true, pairs: 2))
        )
        static let fixturePlateOffSheet = PlatesState(
            unit: .kg,
            setup: fixtureHomeGym,
            plateEditor: PlateEditor(unit: .kg, plate: GymPlate(size: 25, isAvailable: false, pairs: 4))
        )
    }
#endif
