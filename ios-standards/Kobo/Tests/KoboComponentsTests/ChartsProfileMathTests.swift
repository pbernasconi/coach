import Foundation
import Testing

@testable import KoboComponents

@Suite struct ChartsProfileMathTests {
    @Test func segmentsSpanTheWidthInOrder() {
        let shapes = ProfileMath.shapes([
            ProfileSegment(id: 0, width: 300, start: 0.5, level: 0),
            ProfileSegment(id: 1, width: 100, start: 1.0, level: 3),
        ])
        #expect(shapes.map(\.x0) == [0, 0.75])
        #expect(shapes.map(\.x1) == [0.75, 1])
    }

    @Test func heightsAreAgainstTheFloorOrTheTallest() {
        let calm = ProfileMath.shapes([ProfileSegment(id: 0, width: 1, start: 0.625, level: 1)])
        #expect(calm.first?.top0 == 0.5)
        let hard = ProfileMath.shapes([
            ProfileSegment(id: 0, width: 1, start: 1, level: 1),
            ProfileSegment(id: 1, width: 1, start: 2, end: 1, level: 4),
        ])
        #expect(hard.map(\.top0) == [0.5, 1])
        #expect(hard.last?.top1 == 0.5)
    }

    @Test func badSegmentsAreDroppedAndLevelsClamped() {
        let shapes = ProfileMath.shapes([
            ProfileSegment(id: 0, width: 0, start: 1, level: 0),
            ProfileSegment(id: 1, width: .nan, start: 1, level: 0),
            ProfileSegment(id: 2, width: 1, start: 1, level: 9),
        ])
        #expect(shapes.count == 1)
        #expect(shapes.first?.level == 4)
        #expect(ProfileMath.shapes([]).isEmpty)
    }

    @Test func aPointPicksTheSegmentUnderIt() {
        let segments = [
            ProfileSegment(id: 7, width: 300, start: 0.5, level: 0),
            ProfileSegment(id: 8, width: 100, start: 1.0, level: 3),
        ]
        #expect(ProfileMath.segment(at: 0.1, in: segments) == 7)
        #expect(ProfileMath.segment(at: 0.9, in: segments) == 8)
        #expect(ProfileMath.segment(at: 1.2, in: segments) == nil)
    }
}
