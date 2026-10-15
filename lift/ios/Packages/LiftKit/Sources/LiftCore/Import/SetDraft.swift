import Foundation

/// A set line as read, waiting to be resolved against its exercise.
struct SetDraft: Equatable {
    let line: Int
    let done: Bool
    var parsed: ParsedSet
}
