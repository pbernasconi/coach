import Foundation

/// Equipment named in free text: a header suffix (`- barbell`), a line on its own, or words in a name.
enum EquipmentWord {
    /// The equipment a single word or short phrase names, if any.
    static func equipment(for text: String) -> Equipment? {
        let key = NameNormalizer.tokens(text).joined(separator: " ")
        return switch key {
        case "barbell": .barbell
        case "dumbbell": .dumbbell
        case "kettlebell": .kettlebell
        case "machine": .machine
        case "cable": .cable
        case "bodyweight", "bw": .bodyweight
        default: nil
        }
    }

    /// Equipment implied by words inside an exercise name ("Single arm db row" → dumbbell).
    static func infer(fromName name: String) -> Equipment? {
        let tokens = Set(NameNormalizer.tokens(name))
        let order: [Equipment] = [.dumbbell, .kettlebell, .barbell, .cable, .machine]
        return order.first { tokens.contains($0.rawValue) }
    }
}
