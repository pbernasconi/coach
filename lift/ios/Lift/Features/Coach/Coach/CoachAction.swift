import KoboComponents

/// What Paolo can do on the Coach tab.
nonisolated enum CoachAction: Equatable, Sendable {
    case draftChanged(String)
    case sendTapped
    case promptPicked(ChatPrompt)
    case stopTapped
    case retryTapped
    case applyTapped(proposalID: String)
    case dismissTapped(proposalID: String)
    case undoTapped(proposalID: String)
}
