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
    /// The microphone: a tap starts or stops listening; holding talks, and the release sends.
    case micTapped
    case micHoldBegan
    case micHoldEnded
    /// The "turn it on in Settings" row under a denied microphone.
    case voiceSettingsTapped
    /// The composer's +: the attach sheet opens (true) or closes.
    case attachShown(Bool)
    /// Photos and files picked in the attach sheet: they upload at once.
    case filesPicked([ChatPickedFile])
    case attachmentRemoved(String)
    /// A failed upload's tile was tapped.
    case attachmentRetried(String)
    /// A sent photo came on screen: load its tile once.
    case filePreviewNeeded(String)
    /// The conversation came on screen or left it (another tab, a pushed page).
    case shown(Bool)
    /// The app came to the foreground (true) or went to the background.
    case sceneActive(Bool)
}
