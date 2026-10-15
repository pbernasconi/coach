import Foundation
import LiftCore
import Testing

@testable import Lift

/// The summary's record rows: one per exercise, numbers only (made-up values).
@Suite struct WorkoutSummaryTextTests {
    private static let id = UUID(uuid: (0xBB, 0, 0, 0, 0, 0, 0x40, 0, 0x80, 0, 0, 0, 0, 0, 0, 1))

    private static func best(
        heaviest: PersonalBest.Record? = nil,
        estimate: PersonalBest.Record? = nil,
        top: PersonalBest.TopSet,
        value: Weight?
    ) -> PersonalBest {
        PersonalBest(
            exerciseID: id,
            exerciseName: "Bench press",
            heaviest: heaviest,
            estimatedOneRepMax: estimate,
            topSet: top,
            estimate: value
        )
    }

    @Test func aHeavierSetLeadsAndTheEstimateFollows() {
        let item = WorkoutSummaryText.best(
            Self.best(
                heaviest: .init(value: .kg(65), previous: .kg(62.5)),
                estimate: .init(value: .kg(76), previous: .kg(73)),
                top: .init(weight: .kg(65), reps: 5),
                value: .kg(76)
            ),
            unit: .kg
        )
        #expect(item.exercise == "Bench press")
        #expect(item.value == "65 kg")
        #expect(item.detail == "65 kg × 5 · est. 1RM 76 kg (was 73)")
    }

    @Test func anEstimateRecordAloneLeadsWithTheEstimate() {
        let item = WorkoutSummaryText.best(
            Self.best(
                estimate: .init(value: .kg(80), previous: .kg(75.5)),
                top: .init(weight: .kg(60), reps: 10),
                value: .kg(80)
            ),
            unit: .kg
        )
        #expect(item.value == "80 kg")
        #expect(item.detail == "60 kg × 10 · est. 1RM 80 kg (was 75.5)")
    }

    @Test func aHeavierSetWithoutAnEstimateRecordShowsNoWas() {
        let item = WorkoutSummaryText.best(
            Self.best(
                heaviest: .init(value: .kg(70), previous: .kg(60)),
                top: .init(weight: .kg(70), reps: 1),
                value: .kg(70)
            ),
            unit: .kg
        )
        #expect(item.detail == "70 kg × 1 · est. 1RM 70 kg")
    }

    @Test func aBodyweightSetAndNoEstimate() {
        let item = WorkoutSummaryText.best(
            Self.best(
                heaviest: .init(value: .kg(5), previous: .kg(2.5)),
                top: .init(weight: nil, reps: 15),
                value: nil
            ),
            unit: .kg
        )
        #expect(item.detail == "Bodyweight × 15")
        #expect(item.value == "5 kg")
    }
}
