import Foundation

/// A muscle group used for weekly volume.
public enum Muscle: String, Codable, Hashable, Sendable, CaseIterable {
    case chest
    case back
    case shoulders
    case biceps
    case triceps
    case quads
    case hamstrings
    case glutes
    case calves
    case core
    case forearms
}
