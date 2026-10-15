import Foundation

/// How to do one seed exercise: setup, numbered steps, form cues, common mistakes and breathing, plus a video search.
/// Plain text written for Lift; facts checked against common coaching practice. Media (animations, thumbnails) are
/// not part of the guide: see `ExerciseMedia`.
public struct ExerciseGuide: Hashable, Sendable, Identifiable {
    /// The seed exercise this guide is for (`ExerciseLibrary.seedID`).
    public let id: UUID
    /// What to set up before the first rep.
    public let setup: [String]
    /// One rep, in order (4–7 steps).
    public let steps: [String]
    /// Short reminders to think about during the set (2–4).
    public let cues: [String]
    /// What usually goes wrong (2–4).
    public let mistakes: [String]
    public let breathing: String?
    /// What the video button searches for ("romanian deadlift technique").
    public let videoQuery: String
    /// A YouTube video id pinned for this exercise; nil until one is chosen.
    public let curatedVideoID: String?

    init(
        seed number: UInt8,
        setup: [String],
        steps: [String],
        cues: [String],
        mistakes: [String],
        breathing: String?,
        videoQuery: String,
        curatedVideoID: String? = nil
    ) {
        self.id = ExerciseLibrary.seedID(number)
        self.setup = setup
        self.steps = steps
        self.cues = cues
        self.mistakes = mistakes
        self.breathing = breathing
        self.videoQuery = videoQuery
        self.curatedVideoID = curatedVideoID
    }

    /// Every guide, one per seed exercise.
    public static let all: [ExerciseGuide] = squats + singleLeg + hips + chestAndShoulders + rows + pulls + armsAndCore

    private static let byID: [UUID: ExerciseGuide] = Dictionary(all.map { ($0.id, $0) }) { first, _ in first }

    /// The guide for a seed exercise, or nil for an exercise the person created.
    public static func `for`(id: UUID) -> ExerciseGuide? {
        byID[id]
    }

    /// The pinned video when there is one, otherwise a YouTube search for `videoQuery`.
    public var videoURL: URL? {
        if let curatedVideoID {
            var components = URLComponents(string: "https://www.youtube.com/watch")
            components?.queryItems = [URLQueryItem(name: "v", value: curatedVideoID)]
            return components?.url
        }
        return Self.videoSearchURL(for: videoQuery)
    }

    /// A YouTube search results page for `query`. No API key, nothing embedded.
    public static func videoSearchURL(for query: String) -> URL? {
        var components = URLComponents(string: "https://www.youtube.com/results")
        components?.queryItems = [URLQueryItem(name: "search_query", value: query)]
        return components?.url
    }
}
