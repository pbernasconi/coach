import CraftTokens

extension Tone {
    /// The SF Symbol that carries this tone's meaning next to its colour, so status never reads by colour alone.
    var feedbackSymbol: String {
        switch self {
        case .neutral: "info.circle.fill"
        case .accent: "sparkle"
        case .success: "checkmark.circle.fill"
        case .warning: "exclamationmark.triangle.fill"
        case .danger: "xmark.octagon.fill"
        case .info: "info.circle.fill"
        }
    }
}
