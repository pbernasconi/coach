import Foundation
import LiftCore
import Testing

@testable import Lift

/// URLs into the pinned dataset commit, and GIF frame timing.
@Suite struct ExerciseMediaSourceTests {
    let source = ExerciseMediaSource(commit: "7455efae41b330c265e7cd4b78dfa848e7ce5ebd", attribution: "© Gym visual")

    @Test func buildsRawURLsAtThePinnedCommit() {
        let url = source.url(path: "videos/0043-AbC_1.gif")
        #expect(
            url?.absoluteString
                == "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/7455efae41b330c265e7cd4b78dfa848e7ce5ebd/videos/0043-AbC_1.gif"
        )
    }

    @Test(arguments: ["../secret.gif", "videos/../x.gif", "other/0043.gif", "videos/0043.png", "videos/.gif", "videos/a b.gif", ""])
    func refusesPathsOutsideTheMediaFolders(path: String) {
        #expect(source.url(path: path) == nil)
    }

    @Test func refusesAMalformedCommit() {
        #expect(ExerciseMediaSource(commit: "main", attribution: "").url(path: "images/0001-x.jpg") == nil)
    }

    @Test func mediaForAnEntryCarriesBothURLsAndTheCredit() {
        let media = source.media(for: FakeExerciseCatalog.entry("0043", "Squat"))
        #expect(media?.gifURL.lastPathComponent == "0043-abc.gif")
        #expect(media?.thumbnailURL.lastPathComponent == "0043-abc.jpg")
        #expect(media?.attribution == "© Gym visual")
    }

    @Test func gifTimingRepeatsLongFramesAndDefaultsZeroDelays() {
        let timing = GIFTiming.sequence(delays: [0.04, 0, 0.02])
        #expect(timing.frames == [0, 0, 1, 1, 1, 1, 1, 2])
        #expect(abs(timing.duration - 0.16) < 0.000_1)
        #expect(GIFTiming.sequence(delays: Array(repeating: 10, count: 10)).frames.count == GIFTiming.maxFrames)
    }
}
