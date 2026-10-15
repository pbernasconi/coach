import Foundation

/// How a catalog entry becomes a library exercise: Lift's coarser equipment, load mode and muscle groups.
extension CatalogExercise {
    /// The library equipment for the dataset's equipment word.
    public var libraryEquipment: Equipment {
        Self.equipmentMap[equipment] ?? .other
    }

    /// Bodyweight for bodyweight work; per hand for dumbbell work with two bells; otherwise the whole load.
    public var libraryLoadMode: LoadMode {
        switch libraryEquipment {
        case .bodyweight:
            return .bodyweight(added: nil)
        case .dumbbell:
            let lower = name.lowercased()
            let oneBell = Self.oneBellWords.contains { lower.contains($0) }
            return oneBell ? .total : .perHand
        case .barbell, .kettlebell, .machine, .cable, .other:
            return .total
        }
    }

    /// The target muscle as a library muscle group; empty when Lift has no group for it (cardio, neck, adductors).
    public var primaryMuscles: [Muscle] {
        Self.muscleMap[target].map { [$0] } ?? []
    }

    /// The secondary muscles as library groups, without duplicates or the primary group.
    public var secondaryMuscles: [Muscle] {
        var seen = Set(primaryMuscles)
        return secondary.compactMap { Self.muscleMap[$0] }.filter { seen.insert($0).inserted }
    }

    private static let equipmentMap: [String: Equipment] = [
        "barbell": .barbell, "ez barbell": .barbell, "olympic barbell": .barbell, "trap bar": .barbell,
        "smith machine": .barbell, "dumbbell": .dumbbell, "kettlebell": .kettlebell, "cable": .cable,
        "leverage machine": .machine, "sled machine": .machine, "assisted": .machine,
        "upper body ergometer": .machine, "skierg machine": .machine, "stationary bike": .machine,
        "elliptical machine": .machine, "stepmill machine": .machine, "body weight": .bodyweight,
        "weighted": .bodyweight,
    ]

    /// Names that use one dumbbell, so the logged number is the whole load.
    private static let oneBellWords = ["one arm", "single arm", "one-arm", "single-arm", "goblet", "pullover"]

    private static let muscleMap: [String: Muscle] = [
        "abs": .core, "core": .core, "obliques": .core, "abdominals": .core, "lower abs": .core,
        "pectorals": .chest, "chest": .chest, "upper chest": .chest, "serratus anterior": .chest,
        "biceps": .biceps, "brachialis": .biceps, "triceps": .triceps,
        "delts": .shoulders, "shoulders": .shoulders, "deltoids": .shoulders, "rear deltoids": .shoulders,
        "rotator cuff": .shoulders,
        "upper back": .back, "lats": .back, "latissimus dorsi": .back, "spine": .back, "lower back": .back,
        "traps": .back, "trapezius": .back, "rhomboids": .back, "back": .back,
        "quads": .quads, "quadriceps": .quads, "hamstrings": .hamstrings,
        "glutes": .glutes, "abductors": .glutes, "calves": .calves, "soleus": .calves,
        "forearms": .forearms, "wrist flexors": .forearms, "wrist extensors": .forearms, "wrists": .forearms,
        "grip muscles": .forearms, "hands": .forearms,
    ]
}
