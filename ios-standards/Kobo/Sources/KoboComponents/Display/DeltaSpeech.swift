import Foundation

/// What VoiceOver reads for a delta whose text carries its own arrow: "▼ 7%" as "down 7%", "▲ 3 km" as "up 3 km".
nonisolated enum DeltaSpeech {
    static func spoken(_ text: String) -> String {
        let up = String(localized: "up", bundle: .module)
        let down = String(localized: "down", bundle: .module)
        return text.replacingOccurrences(of: "▲", with: up).replacingOccurrences(of: "▼", with: down)
            .replacingOccurrences(of: "↑", with: up).replacingOccurrences(of: "↓", with: down)
            .trimmingCharacters(in: .whitespaces)
    }
}
