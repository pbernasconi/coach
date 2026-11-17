import Foundation
import LiftSync
import Testing

@testable import Lift

/// The workout review: the demo run's decodes, and a pending one is asked for once and shown in its place.
@MainActor
@Suite struct ActivityReviewTests {
    /// A made-up review with one step, `status` as given.
    static func review(_ status: String, headline: String? = nil) -> String {
        let headline = headline.map { "\"\($0)\"" } ?? "null"
        return #"{"ok":true,"score":80,"level":"partial","scoreWord":"Partly on plan","workoutName":"VO2 A","#
            + #""alignedText":"Steps by the clock","extraText":null,"steps":[{"index":0,"label":"Rep 1/5","#
            + #""kind":"work","zone":"Z5","inRepeat":true,"plannedText":"3:00 · Hard","doneText":"3:00 · 4:40/km","#
            + #""hrText":"170","inTargetText":null,"verdict":"hit","verdictLabel":"On target","plannedSeconds":180,"#
            + #""doneSeconds":180}],"sets":[],"flags":[],"ai":{"status":"\#(status)","note":null,"#
            + #""headline":\#(headline),"rating":null,"ratingLabel":null,"sections":[]}}"#
    }

    static func detail(_ status: String) throws -> ActivityDetail {
        let text = #"{"activityId":"42","review":\#(review(status))}"#
        return try JSONDecoder().decode(ActivityDetail.self, from: Data(text.utf8))
    }

    @Test func demoRunHasAReview() throws {
        let run = try #require(TrainingSamples.run)
        let review = try #require(run.review?.value)
        #expect(review.steps.count == 12)
        #expect(review.sets.first?.reps.count == 5)
        #expect(review.ai.status == "ready")
        #expect(review.ai.sections.map(\.key) == ["effect", "well", "improve", "next"])
    }

    @Test func aPendingReviewIsAskedForOnce() async throws {
        let data = FakeAppData()
        data.putResult = .success(Data(Self.review("ready", headline: "Strong reps.").utf8))
        let writer = ActivityReviewWriter(data: data)
        let written = await writer.write(try Self.detail("pending"))
        #expect(written?.ai.headline == "Strong reps.")
        #expect(data.puts.map(\.path) == ["api/app/activities/42/review"])
        #expect(await writer.write(try Self.detail("pending")) == nil, "asked once per activity")
        #expect(data.puts.count == 1)
    }

    @Test func aReadyReviewIsNotAskedFor() async throws {
        let data = FakeAppData()
        #expect(await ActivityReviewWriter(data: data).write(try Self.detail("ready")) == nil)
        #expect(data.puts.isEmpty)
    }

    @Test func theWrittenReviewShowsWhileTheBodySaysPending() throws {
        var state = ActivityDetailState(ref: "strava-42")
        state.workout = TrainingSamples.loaded(WorkoutDetail(activity: try Self.detail("pending")))
        #expect(state.shownReview?.value?.isPending == true)
        let written = try JSONDecoder().decode(AppSection<ActivityReview>.self, from: Data(Self.review("ready").utf8))
        state.writtenReview = written.value
        #expect(state.shownReview?.value?.ai.status == "ready")
    }
}
