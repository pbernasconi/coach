import Foundation

/// The seed library: about thirty common lifts with deterministic ids, so a fresh install, a test and the
/// server all agree on the id of "Back squat".
public enum ExerciseLibrary {
    /// The `createdAt`/`updatedAt` stamp of every seed row (2026-01-01T00:00:00Z).
    public static let seedDate = Date(timeIntervalSince1970: 1_767_225_600)

    /// The stable id of seed row `number`: `4C494654-0000-4000-8000-0000000000NN` ("LIFT").
    public static func seedID(_ number: UInt8) -> UUID {
        UUID(uuid: (0x4C, 0x49, 0x46, 0x54, 0x00, 0x00, 0x40, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, number))
    }

    /// Every seed exercise. Ids never change once shipped; add new rows with new numbers.
    public static let seed: [Exercise] = rows.map(\.exercise)

    private static let rows: [SeedRow] = [
        SeedRow(
            1,
            "Back squat",
            .barbell,
            .total,
            [.quads, .glutes],
            [.hamstrings, .core],
            ["squat", "barbell squat", "squat lift", "high bar squat"]
        ),
        SeedRow(2, "Front squat", .barbell, .total, [.quads], [.glutes, .core], ["barbell front squat"]),
        SeedRow(
            3,
            "Romanian deadlift",
            .barbell,
            .total,
            [.hamstrings, .glutes],
            [.back],
            ["rdl", "romain deadlift", "romanian dl", "barbell rdl"]
        ),
        SeedRow(
            4,
            "Deadlift",
            .barbell,
            .total,
            [.hamstrings, .glutes, .back],
            [.quads, .forearms],
            ["conventional deadlift", "barbell deadlift"]
        ),
        SeedRow(
            5,
            "Bench press",
            .barbell,
            .total,
            [.chest],
            [.triceps, .shoulders],
            ["bench", "barbell bench press", "flat bench", "bb bench"]
        ),
        SeedRow(
            6,
            "Dumbbell bench press",
            .dumbbell,
            .perHand,
            [.chest],
            [.triceps, .shoulders],
            ["db bench", "flat dumbbell press"]
        ),
        SeedRow(
            7,
            "Incline dumbbell press",
            .dumbbell,
            .perHand,
            [.chest, .shoulders],
            [.triceps],
            ["incline db bench", "incline dumbbell bench press"]
        ),
        SeedRow(
            8,
            "Overhead press",
            .barbell,
            .total,
            [.shoulders],
            [.triceps, .core],
            ["ohp", "military press", "barbell overhead press", "standing press"]
        ),
        SeedRow(
            9,
            "Dumbbell shoulder press",
            .dumbbell,
            .perHand,
            [.shoulders],
            [.triceps],
            ["overhead db press", "dumbbell overhead press", "seated dumbbell press"]
        ),
        SeedRow(
            10,
            "Barbell row",
            .barbell,
            .total,
            [.back],
            [.biceps, .forearms],
            ["bent over row", "pendlay row"]
        ),
        SeedRow(
            11,
            "Single-arm dumbbell row",
            .dumbbell,
            .total,
            [.back],
            [.biceps],
            ["one arm dumbbell row", "dumbbell row"]
        ),
        SeedRow(
            12,
            "Chest-supported row",
            .dumbbell,
            .perHand,
            [.back],
            [.biceps],
            ["chest supported db row", "incline row"]
        ),
        SeedRow(13, "Pull-up", .bodyweight, .bodyweight(added: nil), [.back], [.biceps, .forearms], ["pullup"]),
        SeedRow(14, "Chin-up", .bodyweight, .bodyweight(added: nil), [.back, .biceps], [.forearms], ["chinup"]),
        SeedRow(15, "Lat pulldown", .cable, .total, [.back], [.biceps], ["pulldown", "lat pull down"]),
        SeedRow(16, "Seated cable row", .cable, .total, [.back], [.biceps], ["cable row", "seated row"]),
        SeedRow(
            17,
            "Bulgarian split squat",
            .dumbbell,
            .perHand,
            [.quads, .glutes],
            [.hamstrings],
            ["bulgarian squat", "single leg bulgarian squat", "bss", "rear foot elevated split squat"]
        ),
        SeedRow(18, "Reverse lunge", .dumbbell, .perHand, [.quads, .glutes], [.hamstrings], ["db reverse lunge"]),
        SeedRow(19, "Leg press", .machine, .total, [.quads, .glutes], [], ["machine leg press"]),
        SeedRow(20, "Hip thrust", .barbell, .total, [.glutes], [.hamstrings], ["barbell hip thrust"]),
        SeedRow(
            21,
            "Kettlebell swing",
            .kettlebell,
            .total,
            [.glutes, .hamstrings],
            [.core, .back],
            ["kettlebell hip swing", "russian swing"]
        ),
        SeedRow(22, "Calf raise", .machine, .total, [.calves], [], ["standing calf raise"]),
        SeedRow(
            23,
            "Lateral raise",
            .dumbbell,
            .perHand,
            [.shoulders],
            [],
            ["side raise", "db lateral raise", "side lateral raise"]
        ),
        SeedRow(
            24,
            "Dumbbell curl",
            .dumbbell,
            .perHand,
            [.biceps],
            [.forearms],
            ["curl", "biceps curl"]
        ),
        SeedRow(
            25,
            "Overhead triceps extension",
            .dumbbell,
            .total,
            [.triceps],
            [],
            ["oh triceps", "triceps extension"]
        ),
        SeedRow(26, "Face pull", .cable, .total, [.shoulders], [.back], ["cable face pull"]),
        SeedRow(
            27,
            "Single-leg deadlift",
            .dumbbell,
            .total,
            [.hamstrings, .glutes],
            [.core],
            ["single leg rdl", "single leg romanian deadlift", "one leg deadlift"]
        ),
        SeedRow(
            28,
            "Goblet squat",
            .dumbbell,
            .total,
            [.quads, .glutes],
            [.core],
            ["db goblet squat", "kettlebell goblet squat"]
        ),
        SeedRow(29, "Plank", .bodyweight, .bodyweight(added: nil), [.core], [], ["front plank"]),
        SeedRow(30, "Step-up", .dumbbell, .perHand, [.quads, .glutes], [.hamstrings], ["db step up", "box step up"]),
    ]
}

/// One row of the seed table, kept positional so the table stays readable.
private struct SeedRow {
    let exercise: Exercise

    init(
        _ number: UInt8,
        _ name: String,
        _ equipment: Equipment,
        _ loadMode: LoadMode,
        _ primary: [Muscle],
        _ secondary: [Muscle],
        _ aliases: [String]
    ) {
        exercise = Exercise(
            id: ExerciseLibrary.seedID(number),
            name: name,
            aliases: aliases,
            equipment: equipment,
            loadMode: loadMode,
            primary: primary,
            secondary: secondary,
            catalogID: CatalogSeedLinks.seedLink(seedNumber: number)?.catalogID,
            createdAt: ExerciseLibrary.seedDate,
            updatedAt: ExerciseLibrary.seedDate
        )
    }
}
