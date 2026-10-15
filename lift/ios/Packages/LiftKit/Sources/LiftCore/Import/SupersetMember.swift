import Foundation

/// One exercise's part of a superset round (`curls 10 @ 25`).
struct SupersetMember: Equatable {
    var name: String
    var set: ParsedSet
}
