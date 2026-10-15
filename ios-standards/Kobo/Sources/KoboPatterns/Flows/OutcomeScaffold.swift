import KoboComponents
import KoboTokens
import SwiftUI

/// The last screen of a flow: what happened. It moves through `OutcomePhase`: a skeleton while `loading`, a spinning
/// hero while `pending`, then `success`, `failure` or `unknown` with a toned hero, the title and detail, the facts,
/// optional extra content and the pinned actions. A success draws its check once; the words and facts fade in after
/// it; with Reduce Motion everything is simply there. When the entrance lands it plays one haptic (`.success`,
/// `.error`, or `.warning` for unknown) and VoiceOver focus moves to the title. With `shareText` the bar offers the
/// system share sheet. The system back chevron is hidden: the work is done, so the way out is the primary action.
///
///     OutcomeScaffold(phase: .success, title: "Project finished", detail: "Nice work. It's in your history.",
///                     facts: [OutcomeFact("Duration", value: "1 h 12 min"), OutcomeFact("Tasks", value: "18")],
///                     primary: OutcomeAction("Done", action: close),
///                     shareText: OutcomeShareText.text(title: "Project finished", facts: facts))
public struct OutcomeScaffold<Extra: View>: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOver
    @AccessibilityFocusState private var isTitleFocused: Bool
    @State private var isRevealed = false
    @State private var isDrawn = false
    @State private var hasLanded = false
    /// A pending phase already showed the words, so settling does not fade them out and in again.
    @State private var sawPending = false
    private let phase: OutcomePhase
    private let title: Text
    private let detail: Text?
    private let symbol: String?
    private let facts: [OutcomeFact]
    private let primary: OutcomeAction
    private let secondary: OutcomeAction?
    private let shareText: String?
    private let extra: Extra

    /// - Parameters:
    ///   - symbol: an SF Symbol for the hero instead of the phase's own (a success that is not a check).
    ///   - shareText: the words of the share sheet (`OutcomeShareText`); `nil` for no share button.
    ///   - extra: content under the facts (a personal-record callout, a list of skipped lines).
    public init(
        phase: OutcomePhase,
        title: LocalizedStringKey,
        detail: LocalizedStringKey? = nil,
        symbol: String? = nil,
        facts: [OutcomeFact] = [],
        primary: OutcomeAction,
        secondary: OutcomeAction? = nil,
        shareText: String? = nil,
        @ViewBuilder extra: () -> Extra
    ) {
        self.phase = phase
        self.title = Text(title)
        self.detail = detail.map { Text($0) }
        self.symbol = symbol
        self.facts = facts
        self.primary = primary
        self.secondary = secondary
        self.shareText = shareText
        self.extra = extra()
    }

    /// An outcome whose title and detail are shown as is (server copy, a record's name).
    public init(
        phase: OutcomePhase,
        verbatim title: String,
        detail: String? = nil,
        symbol: String? = nil,
        facts: [OutcomeFact] = [],
        primary: OutcomeAction,
        secondary: OutcomeAction? = nil,
        shareText: String? = nil,
        @ViewBuilder extra: () -> Extra
    ) {
        self.phase = phase
        self.title = Text(verbatim: title)
        self.detail = detail.map { Text(verbatim: $0) }
        self.symbol = symbol
        self.facts = facts
        self.primary = primary
        self.secondary = secondary
        self.shareText = shareText
        self.extra = extra()
    }

    public var body: some View {
        ScrollView { column }
            .scrollBounceBehavior(.basedOnSize)
            .background(theme.palette.canvas)
            .pinnedFooter(style: .material, isPresented: phase != .loading) {
                OutcomeFooter(primary: primary, secondary: secondary, isPending: phase == .pending)
            }
            .navigationBarBackButtonHidden(true)
            .toolbar {
                if let shareText, phase.isSettled {
                    ToolbarItem(placement: .primaryAction) { OutcomeShareButton(text: shareText) }
                }
            }
            .koboFeedback(trigger: hasLanded) { played, landed in
                guard landed, let landing = OutcomeLandingFeedback.of(phase, hasPlayed: played) else { return nil }
                return landing.haptic
            }
            .onChange(of: phase, initial: true) { _, phase in
                if phase == .pending { sawPending = true }
                if phase.isSettled { enter() }
            }
    }

    @ViewBuilder private var column: some View {
        if phase == .loading {
            OutcomeLoading().padding(.vertical, Space.xxl).padding(.horizontal, Space.gutter)
        } else {
            OutcomeColumn(
                phase: phase,
                symbol: symbol,
                title: title,
                detail: detail,
                facts: facts,
                isRevealed: isShown,
                isDrawn: isDrawn,
                showsContent: OutcomeEntrance.showsContent(isRevealed: isShown, voiceOver: voiceOver),
                titleFocus: $isTitleFocused,
                extra: extra
            )
        }
    }

    /// The hero and the words show: after the entrance, before a settled phase, or after a pending one.
    private var isShown: Bool { isRevealed || !phase.isSettled || sawPending }

    /// Runs the entrance once, on the first settled phase; its end is the landing that plays the haptic.
    private func enter() {
        guard !isRevealed else { return }
        isTitleFocused = true
        isRevealed = true
        let draw = Motion.present.animation(reduceMotion: reduceMotion)?.delay(OutcomeEntrance.drawDelay)
        withAnimation(draw) {
            isDrawn = true
        } completion: {
            hasLanded = true
        }
    }
}

extension OutcomeScaffold where Extra == EmptyView {
    /// An outcome with no extra content.
    public init(
        phase: OutcomePhase,
        title: LocalizedStringKey,
        detail: LocalizedStringKey? = nil,
        symbol: String? = nil,
        facts: [OutcomeFact] = [],
        primary: OutcomeAction,
        secondary: OutcomeAction? = nil,
        shareText: String? = nil
    ) {
        self.init(
            phase: phase,
            title: title,
            detail: detail,
            symbol: symbol,
            facts: facts,
            primary: primary,
            secondary: secondary,
            shareText: shareText
        ) { EmptyView() }
    }

    /// An outcome with no extra content, whose title and detail are shown as is.
    public init(
        phase: OutcomePhase,
        verbatim title: String,
        detail: String? = nil,
        symbol: String? = nil,
        facts: [OutcomeFact] = [],
        primary: OutcomeAction,
        secondary: OutcomeAction? = nil,
        shareText: String? = nil
    ) {
        self.init(
            phase: phase,
            verbatim: title,
            detail: detail,
            symbol: symbol,
            facts: facts,
            primary: primary,
            secondary: secondary,
            shareText: shareText
        ) { EmptyView() }
    }
}

#if DEBUG
    private struct OutcomeScaffoldPreview: View {
        @State private var phase = OutcomePhase.loading

        var body: some View {
            NavigationStack {
                OutcomeScaffold(
                    phase: phase,
                    verbatim: String(describing: phase).capitalized,
                    detail: "Tap the phases to walk through the outcome.",
                    facts: phase.isSettled ? [OutcomeFact(verbatim: "Duration", value: "1 h 12 min")] : [],
                    primary: OutcomeAction("Next phase") { phase = OutcomePhase.allCases.next(after: phase) },
                    shareText: "Project finished"
                )
            }
        }
    }

    extension [OutcomePhase] {
        fileprivate func next(after phase: OutcomePhase) -> OutcomePhase {
            let index = firstIndex(of: phase).map { $0 + 1 } ?? 0
            return self[index % count]
        }
    }

    #Preview("Phases") { OutcomeScaffoldPreview() }
    #Preview("Failure, dark") {
        NavigationStack {
            OutcomeScaffold(
                phase: .failure,
                title: "Couldn't import",
                detail: "Nothing was saved.",
                primary: OutcomeAction("Try again") {}
            )
        }
        .preferredColorScheme(.dark)
    }
    #Preview("Unknown, AX3") {
        NavigationStack {
            OutcomeScaffold(
                phase: .unknown,
                title: "We don't have the result yet",
                detail: "It may still finish. Check History in a minute.",
                primary: OutcomeAction("Done") {}
            )
        }
        .dynamicTypeSize(.accessibility3)
    }
#endif
