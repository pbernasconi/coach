import Foundation

/// Remote media that shows an exercise being done: an animation, a still thumbnail and the credit to display with
/// them. Loaded at runtime; nothing is bundled. Nil wherever no media is known for an exercise.
public struct ExerciseMedia: Hashable, Sendable {
    /// The animated GIF of one rep.
    public let gifURL: URL
    /// A still image, for lists and for Reduce Motion.
    public let thumbnailURL: URL
    /// The credit line shown under the media.
    public let attribution: String

    public init(gifURL: URL, thumbnailURL: URL, attribution: String) {
        self.gifURL = gifURL
        self.thumbnailURL = thumbnailURL
        self.attribution = attribution
    }
}
