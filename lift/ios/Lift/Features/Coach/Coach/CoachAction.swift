import Foundation
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
    /// A quick reply under Coach's question: sent as Paolo's message.
    case quickReplyTapped(String)
    /// A card's header: its full page.
    case workoutOpened(String)
    case exerciseOpened(String)
    case weekOpened
    case todayOpened
    /// A card's picture came on screen: load it once.
    case mediaNeeded(URL)
}
