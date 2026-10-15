import Foundation
import Testing

@testable import LiftCore

@Suite struct ExerciseGuideTests {
    @Test func everySeedExerciseHasExactlyOneGuide() {
        #expect(ExerciseGuide.all.count == ExerciseLibrary.seed.count)
        #expect(Set(ExerciseGuide.all.map(\.id)) == Set(ExerciseLibrary.seed.map(\.id)))
        for exercise in ExerciseLibrary.seed {
            #expect(ExerciseGuide.for(id: exercise.id)?.id == exercise.id, "\(exercise.name)")
        }
    }

    @Test(arguments: ExerciseLibrary.seed.map(\.name))
    func guideHasEnoughToTeachTheLift(name: String) throws {
        let exercise = try #require(ExerciseLibrary.seed.first { $0.name == name })
        let guide = try #require(ExerciseGuide.for(id: exercise.id))
        #expect(!guide.setup.isEmpty, "\(name)")
        #expect((4...7).contains(guide.steps.count), "\(name)")
        #expect((2...4).contains(guide.cues.count), "\(name)")
        #expect((2...4).contains(guide.mistakes.count), "\(name)")
        #expect(guide.breathing?.isEmpty == false, "\(name)")
        #expect(guide.videoQuery.hasSuffix("technique"), "\(name)")
        #expect(guide.curatedVideoID == nil, "\(name)")
        let lines = guide.setup + guide.steps + guide.cues + guide.mistakes
        #expect(lines.allSatisfy { !$0.trimmingCharacters(in: .whitespaces).isEmpty }, "\(name)")
    }

    @Test func anExerciseThePersonMadeHasNoGuide() {
        #expect(ExerciseGuide.for(id: UUID(uuid: (1, 2, 3, 4, 5, 6, 0x40, 8, 0x80, 10, 11, 12, 13, 14, 15, 16))) == nil)
    }

    @Test func videoURLSearchesYouTubeForTheQuery() throws {
        let guide = try #require(ExerciseGuide.for(id: ExerciseLibrary.seedID(3)))
        #expect(
            guide.videoURL?.absoluteString
                == "https://www.youtube.com/results?search_query=romanian%20deadlift%20technique"
        )
        #expect(ExerciseGuide.videoSearchURL(for: "a&b")?.absoluteString == "https://www.youtube.com/results?search_query=a%26b")
    }
}
