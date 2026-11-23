import Foundation

/// The warm-up every lift workout starts with: a short checklist (easy cardio and a few prep moves) and warm-up sets
/// planned as real "W" rows before the working sets.
///
/// - Heavy day (a barbell lift heavy enough for `WarmUpPlanner`): the full ramp (bar ×10, ~50% ×5, ~70% ×3, ~85% ×1)
///   on the first such lift only; each later heavy barbell lift gets one set at about 60% ×5, since the same muscles
///   are already warm. Checklist: 5 min easy cardio and four prep moves.
/// - Light day (no heavy barbell lift): one feeler set at about half weight ×8 on the first loaded exercise.
///   Checklist: 2–3 min of easy cardio and two prep moves.
public enum WarmUpRecipe {
    /// One exercise of the workout, in order: what it is done with and its first working set's weight.
    public struct Exercise: Sendable, Equatable {
        public var equipment: Equipment?
        public var loadMode: LoadMode
        /// The first working set's target weight; nil when it has none.
        public var working: Weight?

        public init(equipment: Equipment?, loadMode: LoadMode, working: Weight?) {
            self.equipment = equipment
            self.loadMode = loadMode
            self.working = working
        }
    }

    /// The warm-up of a workout: the sets for each exercise (same order, empty when it gets none) and the checklist.
    public struct Plan: Sendable, Equatable {
        public var sets: [[SetTarget]]
        public var checklist: WarmUpChecklist
        /// A heavy barbell day: the full ramp and the longer checklist.
        public var isHeavy: Bool
    }

    /// The single warm-up set of a later heavy barbell lift.
    static let laterLift: (fraction: Double, reps: Int) = (0.6, 5)
    /// The feeler set of a light day.
    static let feeler: (fraction: Double, reps: Int) = (0.5, 8)

    /// The heavy day's checklist: easy cardio (the run to the gym counts), then prep moves with no long holds and no
    /// jumps. The slow calf raise is the Achilles check.
    public static let heavyChecklist = [
        "Easy cardio · 5 min",
        "90-90 hip switches · 5 / side",
        "Hip flexor rock · 8 / side",
        "Bird dog · 5 / side",
        "Slow calf raise · 10",
    ]

    /// The light day's checklist.
    public static let lightChecklist = [
        "Easy cardio · 2–3 min",
        "Band pull-aparts · 15",
        "Arm circles · 10",
    ]

    /// The warm-up for `exercises`, loads rounded to what `gym` can make.
    public static func plan(_ exercises: [Exercise], gym: GymSetup = .standard) -> Plan {
        var sets: [[SetTarget]] = Array(repeating: [], count: exercises.count)
        var rampDone = false
        for (index, exercise) in exercises.enumerated() {
            guard let working = exercise.working, isHeavyBarbell(exercise) else { continue }
            let plates = gym.plateSet(working.unit)
            if !rampDone {
                sets[index] = WarmUpPlanner.plan(working: working, equipment: .barbell, plates: plates)
                rampDone = !sets[index].isEmpty
            } else {
                let target = PlateMath.nearestLoadable(to: working.scaled(by: laterLift.fraction), using: plates).total
                if target.value > plates.bar, target.value < working.value - 1e-9 {
                    sets[index] = [SetTarget(reps: laterLift.reps, weight: target)]
                }
            }
        }
        if !rampDone, let index = exercises.firstIndex(where: { feelerWeight($0, gym: gym) != nil }),
            let weight = feelerWeight(exercises[index], gym: gym)
        {
            sets[index] = [SetTarget(reps: feeler.reps, weight: weight)]
        }
        let items = rampDone ? heavyChecklist : lightChecklist
        return Plan(sets: sets, checklist: WarmUpChecklist(items: items), isHeavy: rampDone)
    }

    /// A barbell loaded in total, heavy enough for a ramp.
    private static func isHeavyBarbell(_ exercise: Exercise) -> Bool {
        guard exercise.equipment == .barbell, exercise.loadMode == .total, let working = exercise.working else {
            return false
        }
        return working.value >= (WarmUpPlanner.minimumWorking[working.unit] ?? 0)
    }

    /// About half the working weight, on the equipment's increment; nil when that is nothing or not lighter.
    private static func feelerWeight(_ exercise: Exercise, gym: GymSetup) -> Weight? {
        guard let working = exercise.working, working.value > 0, !exercise.loadMode.isBodyweight else { return nil }
        let increment = gym.increment(for: exercise.equipment, in: working.unit)
        let weight = working.scaled(by: feeler.fraction).rounded(to: increment)
        guard weight.value > 0, weight.value < working.value - 1e-9 else { return nil }
        if exercise.equipment == .barbell, weight.value <= gym.plateSet(working.unit).bar { return nil }
        return weight
    }
}

/// The warm-up's checklist, kept in the session's warm-up note as one line per item: "[ ] Bird dog · 5 / side" while
/// it is to do, "[x] Bird dog · 5 / side" once ticked. A line without a box (an imported "5 min rower") counts as done.
public struct WarmUpChecklist: Sendable, Equatable {
    public struct Item: Sendable, Equatable {
        public var text: String
        public var isDone: Bool

        public init(text: String, isDone: Bool) {
            self.text = text
            self.isDone = isDone
        }
    }

    public var items: [Item]

    public init(items: [String]) {
        self.items = items.map { Item(text: $0, isDone: false) }
    }

    public init(items: [Item]) {
        self.items = items
    }

    /// The checklist in a warm-up note, or nil when the note has no box on any line (a plain note).
    public init?(note: String?) {
        let lines = (note ?? "").split(whereSeparator: \.isNewline)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        guard lines.contains(where: { Self.box(of: $0) != nil }) else { return nil }
        items = lines.map { line in
            guard let box = Self.box(of: line) else { return Item(text: line, isDone: true) }
            let text = line.dropFirst(3).trimmingCharacters(in: .whitespaces)
            return Item(text: text, isDone: box)
        }
    }

    /// The note that stores the checklist.
    public var note: String {
        items.map { "\($0.isDone ? "[x]" : "[ ]") \($0.text)" }.joined(separator: "\n")
    }

    public var doneCount: Int { items.count(where: \.isDone) }
    public var isComplete: Bool { !items.isEmpty && items.allSatisfy(\.isDone) }

    /// The checklist with item `index` ticked or unticked.
    public func toggling(_ index: Int) -> WarmUpChecklist {
        guard items.indices.contains(index) else { return self }
        var copy = self
        copy.items[index].isDone.toggle()
        return copy
    }

    /// The checklist with every item ticked.
    public func allDone() -> WarmUpChecklist {
        WarmUpChecklist(items: items.map { Item(text: $0.text, isDone: true) })
    }

    /// True for "[x]", false for "[ ]", nil for a line without a box.
    private static func box(of line: String) -> Bool? {
        let head = line.prefix(3).lowercased()
        if head == "[ ]" { return false }
        if head == "[x]" { return true }
        return nil
    }
}
