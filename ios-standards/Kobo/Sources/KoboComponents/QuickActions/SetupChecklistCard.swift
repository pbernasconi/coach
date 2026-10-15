import KoboTokens
import SwiftUI

/// A first-run checklist on a home screen ("Finish setting up"): the title with a trailing "1 of 3" and an optional
/// "…" menu that hides the card, a segmented bar with one segment per step, then one row per step. An open step is a
/// button with a chevron; a done step shows a filled check and is static. VoiceOver reads the bar as "1 of 3 steps
/// done" and each row as "title, caption, Done/Not done".
///
/// A step finished in a pushed flow shows after the pop back settles, never while the page moves and never on the
/// first load (`SetupChecklistPresentation`): the new segment fills on `Motion.present`, the mark fills on
/// `Motion.state` and its check pops in. With Reduce Motion everything changes at once.
///
///     SetupChecklistCard("Finish setting up", steps: onboarding.steps, onHide: hideChecklist) { id in open(id) }
public struct SetupChecklistCard: View {
    @Environment(\.koboTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var presentation: SetupChecklistPresentation<[SetupChecklistStep]>
    private let title: Text
    private let steps: [SetupChecklistStep]
    private let totalSteps: Int?
    private let onHide: (() -> Void)?
    private let onSelect: (SetupChecklistStep.ID) -> Void

    /// - Parameters:
    ///   - totalSteps: every step the app counts, when it lists fewer rows than it counts.
    ///   - onHide: adds a "…" menu with "Hide".
    ///   - onSelect: an open step was tapped.
    public init(
        _ title: LocalizedStringKey,
        steps: [SetupChecklistStep],
        totalSteps: Int? = nil,
        onHide: (() -> Void)? = nil,
        onSelect: @escaping (SetupChecklistStep.ID) -> Void
    ) {
        self.init(title: Text(title), steps: steps, totalSteps: totalSteps, onHide: onHide, onSelect: onSelect)
    }

    /// A checklist whose title is shown as is.
    public init(
        verbatim title: String,
        steps: [SetupChecklistStep],
        totalSteps: Int? = nil,
        onHide: (() -> Void)? = nil,
        onSelect: @escaping (SetupChecklistStep.ID) -> Void
    ) {
        self.init(
            title: Text(verbatim: title),
            steps: steps,
            totalSteps: totalSteps,
            onHide: onHide,
            onSelect: onSelect
        )
    }

    private init(
        title: Text,
        steps: [SetupChecklistStep],
        totalSteps: Int?,
        onHide: (() -> Void)?,
        onSelect: @escaping (SetupChecklistStep.ID) -> Void
    ) {
        self.title = title
        self.steps = steps
        self.totalSteps = totalSteps
        self.onHide = onHide
        self.onSelect = onSelect
        _presentation = State(initialValue: SetupChecklistPresentation().received(steps).next)
    }

    public var body: some View {
        let shown = presentation.shown ?? steps
        let done = SetupChecklistProgress.doneCount(shown)
        let count = SetupChecklistProgress.stepCount(shown, totalSteps: totalSteps)
        VStack(alignment: .leading, spacing: Space.md) {
            SetupChecklistHeader(title: title, done: done, count: count, onHide: onHide)
            SetupChecklistBar(fills: SetupChecklistProgress.segmentFills(shown, totalSteps: totalSteps))
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(Text("\(done) of \(count) steps done", bundle: .module))
            VStack(spacing: 0) {
                ForEach(shown) { step in
                    SetupChecklistRow(step: step) { onSelect(step.id) }
                }
            }
        }
        .koboCard()
        .onChange(of: steps) { _, next in apply(presentation.received(next)) }
        .onArrival { apply(presentation.pageSettled()) }
        .onDisappear { presentation = presentation.pageLeft() }
    }

    private func apply(_ change: SetupChecklistPresentation<[SetupChecklistStep]>.Change) {
        guard change.animates else {
            presentation = change.next
            return
        }
        withKoboAnimation(.present, reduceMotion: reduceMotion) { presentation = change.next }
    }
}

#if DEBUG
    private struct SetupChecklistCardPreview: View {
        @State private var steps = [
            SetupChecklistStep(
                id: "goal",
                title: "Set a weekly goal",
                caption: "Pick how often you train.",
                isDone: true
            ),
            SetupChecklistStep(
                id: "plan",
                title: "Plan your first week",
                caption: "Choose three focus days.",
                isDone: false
            ),
            SetupChecklistStep(id: "notify", title: "Turn on reminders", isDone: false),
        ]

        var body: some View {
            ScrollView {
                SetupChecklistCard("Finish setting up", steps: steps, onHide: {}) { id in
                    steps = steps.map {
                        $0.id == id ? .init(id: $0.id, title: $0.title, caption: $0.caption, isDone: true) : $0
                    }
                }
                .pageGutter()
            }
            .screenCanvas()
        }
    }

    #Preview("Setup checklist card") { SetupChecklistCardPreview() }
    #Preview("Setup checklist card · dark, Amber") {
        SetupChecklistCardPreview().koboTheme(.amber).preferredColorScheme(.dark)
    }
    #Preview("Setup checklist card · AX3") { SetupChecklistCardPreview().dynamicTypeSize(.accessibility3) }
#endif
