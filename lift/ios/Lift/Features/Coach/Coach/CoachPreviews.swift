#if DEBUG
    import KoboTokens
    import SwiftUI

    private func coachPreview(_ state: CoachState) -> some View {
        NavigationStack { CoachContent(state: state, send: { _ in }) }.koboTheme(.lift)
    }

    #Preview("Empty") { coachPreview(.fixtureEmpty) }
    #Preview("Empty, dark") { coachPreview(.fixtureEmpty).preferredColorScheme(.dark) }
    #Preview("Proposal") { coachPreview(.fixtureProposal) }
    #Preview("Proposal, dark") { coachPreview(.fixtureProposal).preferredColorScheme(.dark) }
    #Preview("Proposal, AX3") { coachPreview(.fixtureProposal).dynamicTypeSize(.accessibility3) }
    #Preview("Applied") { coachPreview(.fixtureApplied) }
    #Preview("Waiting") { coachPreview(.fixtureWaiting) }
    #Preview("Thinking") { coachPreview(.fixtureThinking) }
    #Preview("Thinking, dark") { coachPreview(.fixtureThinking).preferredColorScheme(.dark) }
    #Preview("Streaming") { coachPreview(.fixtureStreaming) }
    #Preview("Streaming, AX3") { coachPreview(.fixtureStreaming).dynamicTypeSize(.accessibility3) }
    #Preview("Failed") { coachPreview(.fixtureFailed) }
#endif
