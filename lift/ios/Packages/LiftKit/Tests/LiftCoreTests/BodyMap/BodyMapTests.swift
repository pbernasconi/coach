import Foundation
import LiftCore
import Testing

/// The body map: the path text it reads, the bundled drawing, and how sets turn into shades.
@Suite struct BodyMapTests {
    @Test func parsesEveryCommand() throws {
        let steps = try BodyPathParser.parse("M 1 2 L 3 4.5 C 1 1 2 2 3 3 Q 5 6 7 8 Z")
        #expect(
            steps == [
                .move(BodyPoint(1, 2)),
                .line(BodyPoint(3, 4.5)),
                .cubic(BodyPoint(1, 1), BodyPoint(2, 2), to: BodyPoint(3, 3)),
                .quad(BodyPoint(5, 6), to: BodyPoint(7, 8)),
                .close,
            ]
        )
    }

    @Test(arguments: ["M 1", "X 1 2", "L a b", "C 1 2 3"])
    func rejectsBrokenText(_ text: String) {
        #expect(throws: AppError.self) { try BodyPathParser.parse(text) }
    }

    @Test func bundledDrawingHasEveryMuscleOnTheRightSide() throws {
        let art = try BodyMapArt.bundled()
        let front = Set(art.front.parts.map(\.region))
        let back = Set(art.back.parts.map(\.region))
        #expect(front.isSuperset(of: [.chest, .abs, .obliques, .quadriceps, .biceps, .deltoids, .forearm]))
        #expect(back.isSuperset(of: [.upperBack, .lowerBack, .trapezius, .gluteal, .hamstring, .triceps, .calves]))
        #expect(art.front.bounds.width > 0 && art.back.bounds.height > art.back.bounds.width)
        #expect(art.front.parts.allSatisfy { !$0.shapes.isEmpty && $0.shapes.allSatisfy { $0.first.isMove } })
    }

    @Test(arguments: [
        (0.0, BodyShade.none), (0.5, .light), (1.5, .light), (2, .medium), (3.5, .medium), (4, .full), (9, .full),
    ])
    func shadeFromSets(_ sets: Double, _ shade: BodyShade) {
        #expect(BodyShade(sets: sets) == shade)
    }

    @Test func everyMuscleIsDrawn() {
        for muscle in Muscle.allCases {
            #expect(!muscle.bodyRegions.isEmpty)
            #expect(!muscle.bodyRegions.contains(.outline))
        }
    }

    @Test func eachAreaLeadsBackToItsMuscle() {
        for muscle in Muscle.allCases {
            #expect(muscle.bodyRegions.allSatisfy { $0.muscle == muscle })
        }
        #expect(BodyRegion.adductors.muscle == nil)
        #expect(BodyRegion.outline.muscle == nil)
    }

    @Test func sessionShadesTakeTheStrongerShade() {
        let shades = BodyMapShading.shades(sets: [.back: 4, .core: 1, .chest: 0])
        #expect(shades[.upperBack] == .full)
        #expect(shades[.trapezius] == .full)
        #expect(shades[.abs] == .light)
        #expect(shades[.chest] == BodyShade.none)
        #expect(shades[.quadriceps] == nil)
    }
}

extension Optional where Wrapped == BodyPathStep {
    fileprivate var isMove: Bool {
        if case .move = self { return true }
        return false
    }
}
