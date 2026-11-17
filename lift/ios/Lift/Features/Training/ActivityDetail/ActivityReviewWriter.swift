import Foundation
import LiftSync

/// Asks the server to write a workout review the page shows as pending (a new activity), once per activity, and
/// returns it. Strava's webhook usually wrote it already; a failure (writing can outlast the request's wait) returns
/// nil and leaves the card as it is, and the server still saves the review for the next read.
final class ActivityReviewWriter {
    private let data: any AppDataSource
    private var asked: Set<String> = []

    init(data: any AppDataSource) {
        self.data = data
    }

    func write(_ activity: ActivityDetail?) async -> ActivityReview? {
        guard let activity, activity.review?.value?.isPending == true, !asked.contains(activity.activityId) else {
            return nil
        }
        asked.insert(activity.activityId)
        do {
            let body = try await data.put(ActivityReview.path(activity.activityId), body: Data("{}".utf8))
            let section = try JSONDecoder().decode(AppSection<ActivityReview>.self, from: body)
            guard let review = section.value, !review.isPending else { return nil }
            return review
        } catch {
            AppLog.sync.error("Workout review not written: \(String(describing: error), privacy: .public)")
            return nil
        }
    }
}
