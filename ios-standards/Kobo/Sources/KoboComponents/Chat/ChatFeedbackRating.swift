import Foundation

/// The reader's rating of an assistant's reply: thumbs up or down. `nil` is no rating.
nonisolated public enum ChatFeedbackRating: String, Equatable, Sendable, CaseIterable {
    case up, down

    /// The rating after a tap on `tapped`: the same thumb again clears it, the other one replaces it.
    public static func tapping(_ tapped: ChatFeedbackRating, from current: ChatFeedbackRating?) -> ChatFeedbackRating? {
        current == tapped ? nil : tapped
    }
}
